# Mobile interface readiness

## Implemented

- Shared safe-area inset variables and dynamic viewport height for dialogs, bestiary,
  tutorial, practice, fusion reveal, and equipment exchange. Shop width respects the
  available padded container rather than forcing a viewport-wide panel.
- Readable shop descriptions and fusion details, narrow 320px equipment layouts,
  wrapping preview controls and settings segments, 44px touch controls and focus rings.
- HUD vertical positions account for the top notch; boss status is separated from the
  fusion action. Landscape HUD is condensed without reducing the pause touch target.
- Main dialogs confine Tab navigation. Opening a dialog clears held movement;
  movement keys while input is disabled do not leak into resumed gameplay.
- Story typing stops on visibility/pagehide and resumes with a rebased clock, without
  typing through a chapter while the user is away. Reduced-motion UI rule included.
- User palette preserved. Title and loading branding are maintained separately.

## Verification

Baseline before changes: 800/800 Node tests passed. Focused UI, pointer/targeting,
keyboard and story tests: 75/75 passed. Regression coverage includes forward/reverse
Tab cycling and focus restoration, held movement across pause, ignored dialog arrow
keys, and hidden-page story timing. Existing tests exercise tap vs drag, drag-return,
long press, pointer cancellation, lost capture and multitouch classification.

`node tools/mobile-ui-qa.mjs` is the real Chromium smoke runner. It covers 320x568,
360x640, 390x844, 430x932, 568x320 and 844x390; shop, settings, tech selection,
bestiary, equipment choices with expanded recipes, exchange and fusion. It checks
panel bounds and horizontal scroll overflow and captures shop/choice screenshots.
It also simulates nonzero notch insets with the shared CSS variables; that simulation
is distinct from a physical notched-device test.

**Browser run pending:** this execution sandbox prevented Chromium's Unix socket
creation. The approved escalated attempt also failed during sandbox setup, before a
browser started. No viewport screenshots or physical-phone validation are claimed.
Run the smoke runner in a browser-capable CI environment, or inspect the deployed
preview through the approved cloud browser before production promotion.
