# Runbook: Rollback drills

Golden rule: **mitigate first, debug later.** Restore service with a rollback,
then fix the bug on a feature branch.

## Drill 1: Static site (S3 + CloudFront), Week 4

`main` is protected, so a rollback goes through a revert PR.

1. Merge a PR with an intentional, visible UI bug (e.g. break the home page heading).
2. Wait for **Deploy Static Site via AWS CDK** to finish and confirm the bug at the
   `SiteUrl` output (CloudFront, or the S3 website URL while `USE_CLOUDFRONT` is off).
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
4. The deploy runs again; with CloudFront on, `BucketDeployment` also invalidates `/*`.
   Verify the fix within ~2 minutes and record the timings.

## How container releases and rollbacks work

Every image is pushed to ECR with its commit SHA as the tag, and the deploy runs
`cdk deploy -c imageTag=<sha>`. Each release is therefore its own ECS task definition
revision, pinned to an image that never changes.

- **Automatic:** if a release's tasks never pass `/api/health`, the ECS deployment circuit
  breaker fails the deployment and returns to the previous revision, which runs the
  previous image. CloudFormation then rolls the stack back too.
- **Manual:** **Rollback Container** deploys any earlier SHA through CDK, for releases that
  are healthy but wrong.

> Earlier versions ran every revision from the moving `latest` tag. Rolling back to the
> previous revision then pulled `latest` again, which was the same bad image, so a bad image
> could not be rolled back. The manual rollback retagged `latest` outside CDK, which also left
> the infrastructure out of step with the code. Pinning by SHA fixes both.

## Drill 2: Container (ECR + ECS), Week 7

1. On a feature branch, make `/api/health` return HTTP 500, merge it, and let
   **Deploy Container to AWS** run.
2. Observe:
   - the ECS deployment circuit breaker failing the release and returning to the previous
     revision (ECS → service → **Deployments** and **Events**); the old task keeps
     serving throughout because of the rolling update (minimum 100% healthy);
   - the `ServerErrorsAlarm` and `UnhealthyTargetsAlarm` in CloudWatch → Alarms;
   - 5xx log lines in Logs Insights on `/ecs/astro-blog`:
     ```
     fields @timestamp, @message | filter statusCode >= 500 | sort @timestamp desc | limit 20
     ```
3. Manual rollback: Actions → **Rollback Container** → *Run workflow*, with `image_tag` =
   the full SHA of the last good commit (`git log --format=%H -n 5`). It checks the image
   exists in ECR, deploys it with CDK, waits for the service to be stable and smoke-tests
   `/api/health`.
4. Revert the broken PR so `main` is healthy again, then write a blameless
   post-mortem: detection time, mitigation time, root cause and follow-ups.

## Drill log

### 28 Oct 2026: crash-on-start release, automatic rollback

- **Fault:** task definition revision 8 added `NODE_OPTIONS=--require /drill/injected-fault.js`,
  so Node exited at start-up (`Error: Cannot find module '/drill/injected-fault.js'` in
  CloudWatch Logs).
- **Timeline (UTC):**
  - 13:01:15: revision 8 deployed
  - 13:03: first task failed
  - 13:10:54: the circuit breaker failed the deployment after 3 failed tasks and rolled back
  - 13:12:17: back on revision 7, deployment `COMPLETED`
- **Impact:** none. A probe every 5 s returned 200 for all 122 checks; the old task served
  throughout.
- **Follow-up:** the drill changed the task definition, not the image. Reviewing it showed
  that a bad *image* could not have been rolled back, because every revision used `latest`.
  Fixed by pinning each release to its commit SHA (see above).
