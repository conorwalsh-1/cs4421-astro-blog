# Runbook: Rollback drills

Golden rule: **mitigate first, debug later.** Restore service with a rollback,
then fix the bug on a feature branch.

## Drill 1: Static site (S3 + CloudFront), Week 4

`main` is protected, so a rollback goes through a revert PR.

1. Merge a PR with an intentional, visible UI bug (e.g. break the home page heading).
2. Wait for **Deploy Static Site via AWS CDK** to finish and confirm the bug at the
   CloudFront `SiteUrl`.
3. Roll back, either way:
   - **GitHub UI:** open the merged PR → **Revert** → merge the generated revert PR.
   - **Terminal:**
     ```bash
     git checkout main && git pull
     git checkout -b revert/fix-outage
     git revert HEAD --no-edit   # use -m 1 when reverting a merge commit
     git push -u origin revert/fix-outage
     ```
     Open and merge the PR.
4. The deploy runs again and `BucketDeployment` invalidates `/*` on CloudFront.
   Verify the fix within ~2 minutes and record the timings.

## Drill 2: Container (ECR + ECS), Week 7

1. On a feature branch, make `/api/health` return HTTP 500, merge it, and let
   **Deploy Container to AWS** run.
2. Observe:
   - the `ServerErrorsAlarm` and `UnhealthyTargetsAlarm` in CloudWatch → Alarms;
   - 5xx log lines in Logs Insights on `/ecs/astro-blog`:
     ```
     fields @timestamp, @message | filter statusCode >= 500 | sort @timestamp desc | limit 20
     ```
   - the ECS deployment circuit breaker rolling back automatically if the new
     tasks never pass health checks.
3. Manual rollback in seconds: Actions → **Rollback Container** → *Run workflow*,
   with `image_tag` = the SHA of the last good commit (`git log --oneline`).
   This repoints `latest` at that image and forces a new rolling deployment.
4. Revert the broken PR so `main` is healthy again, then write a blameless
   post-mortem: detection time, mitigation time, root cause and follow-ups.
