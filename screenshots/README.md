# Screenshots

App captures of the core flows, referenced from the root [README](../README.md).

**Naming:** the numbered core-loop captures follow `NN-surface-role-subject.png`,
where `NN` is a two-digit order number, the surface is `mobile` or `admin`, the
role is `owner` / `driver` / `admin` / `both`, and the subject is a short
kebab-case phrase (e.g. `06-mobile-owner-cost-estimate.png`). Platform-specific onboarding and
permission captures are prefixed by platform instead (`android-…`, `iphone-…`).

## Core loop

### 1. Driver verification upload
A driver uploads their licence, national ID, and vehicle registration — mandatory before they can work.

![Driver verification upload](01-mobile-driver-verification-upload.png)

### 2. Admin — verification queue
The internal admin console lists drivers awaiting review, grouped by driver.

![Admin verification queue](02-admin-admin-verification-queue.png)

### 3. Admin — document review
An admin opens a submitted document to approve it.

![Admin document review](03-admin-admin-document-review.png)

Rejecting a document with a reason, which the driver then sees.

![Admin document review — reject with reason](03-admin-admin-document-review-reject.png)

### 4. Driver online
Once verified, the driver goes online and becomes available for matching.

![Driver online](04-mobile-driver-online.png)

### 5. Owner — create job
A cargo owner sets pickup and drop-off on the map and describes the load.

![Owner create job](05-mobile-owner-create-job.png)

### 6. Owner — cost estimate
The system shows an estimated cost and distance; the owner sets the final price.

![Owner cost estimate](06-mobile-owner-cost-estimate.png)

### 7. Owner — nearby drivers
Available, verified drivers nearby, ordered by proximity and filtered by vehicle type.

![Owner nearby drivers](07-mobile-owner-nearby-drivers.png)

### 8. Owner — send proposal
The owner selects a driver and sends a proposal at the posted price.

![Owner send proposal](08-mobile-owner-send-proposal.png)

### 9. Driver — job request
The driver receives the proposal and can accept or decline.

![Driver job request](09-mobile-driver-job-request.png)

### 10. Messaging
In-app chat opens between owner and driver once the proposal is accepted.

![In-app chat](10-mobile-both-chat.png)

### 11. Driver sees a rejected document
The driver's verification screen shows a rejected document with the admin's reason and a "Replace Document" action; re-uploading returns the record to pending.

![Driver sees a rejected document](11-mobile-driver-verification-rejected.png)

### 12. Rate the driver
After a completed job, the owner rates the driver (and the driver rates the owner), feeding each profile's reputation.

![Rate the driver](12-mobile-owner-rate-driver.png)

### 13. Admin metrics dashboard
The server-computed evaluation metrics: time-to-match, estimate-accepted-unchanged, in-app coordination, verification completion, match rate, and proposal acceptance.

![Admin metrics dashboard](13-admin-admin-metrics.png)

### 14. Driver ratings (portable reputation)
The driver's My Ratings screen: the aggregate score and the reviews received from cargo owners.

![Driver My Ratings](14-mobile-driver-my-ratings.jpeg)

## Onboarding & permissions

### Welcome
The welcome screen on Android.

![Android welcome screen](android-welcome-screen.png)

The welcome screen on iPhone.

![iPhone welcome screen](iphone-welcome-screen.png)

### Permission prompts
The location permission request on Android.

![Android location permission](android-mobile-permission-location.png)

The notifications permission request on iPhone.

![iPhone notifications permission](iphone-mobile-permission-notifications.png)
