# Enhanced for Todoist, Desktop (macOS)

The [Enhanced for Todoist](https://github.com/julesvbertolino/todoist-enhanced)
web app in its own window, with a **global quick-add**: press **Option + Space**
from any app and the composer opens on top of it.

An independent project, not created by, affiliated with, or supported by Todoist.

## Download

| Your Mac | Download |
|---|---|
| Apple silicon (M1, M2, M3, M4…) | [Enhanced-for-Todoist-arm64.dmg](https://github.com/julesvbertolino/todoist-enhanced-desktop/releases/latest/download/Enhanced-for-Todoist-arm64.dmg) |
| Intel | [Enhanced-for-Todoist-x64.dmg](https://github.com/julesvbertolino/todoist-enhanced-desktop/releases/latest/download/Enhanced-for-Todoist-x64.dmg) |

Not sure which one? Apple menu, **About This Mac**: "Chip: Apple M…" is Apple
silicon, "Processor: Intel…" is Intel.

## Install, in three steps

1. Open the `.dmg` and drag **Enhanced for Todoist** into **Applications**.
2. Open it from Applications. The first time, macOS says it "cannot verify" the
   app, because it is not notarized by Apple (that needs a paid developer
   account). To allow it once:
   - **macOS 15 (Sequoia) and later:** click **Done**, open **System Settings,
     Privacy & Security**, scroll down to the message about Enhanced for Todoist
     and click **Open Anyway**.
   - **Earlier macOS:** right-click the app, **Open**, then **Open**.
   - Or, in Terminal: `xattr -dr com.apple.quarantine "/Applications/Enhanced for Todoist.app"`
3. Sign in to Todoist in the main window. The quick-add window shares that
   session, so press **Option + Space** afterwards.

## Updates

The app loads the hosted site, so **the app itself is always up to date**: a
new release of Enhanced for Todoist is there the next time the window loads
(the quick-add window reloads its page when it is more than ten minutes old).
This shell only changes when you download a new version here, which is rare.

## The shortcut

Option + Space can be changed, if another app already uses it, in
`~/Library/Application Support/enhanced-for-todoist-desktop/config.json`:

```json
{ "quickAddShortcut": "Alt+Shift+Space" }
```

(`QUICKADD_SHORTCUT` in the environment does the same.)

## Privacy

Nothing is bundled and nothing is collected: the window shows
`https://todoistenhanced.julesbertolino.fr/`, which talks to Todoist directly
from your computer. Links to other sites open in your browser.

## Build it yourself

```bash
npm install
npm start            # runs it
npm run pack         # builds dist/mac-*/Enhanced for Todoist.app
```

Use Node 22. To try a local copy of the site, run it on port 5192 and start
with `ENHANCED_URL=http://localhost:5192/ npm start`.

Releases are built by GitHub Actions when a `v*` tag is pushed.

## Limits

macOS only for now (the shortcut and the window are built for it). Signing in
with Google, Apple or Facebook opens your browser, which the window cannot
complete: use your e-mail and password or the API token.

## Licence

MIT.
