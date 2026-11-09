# RPG Maker MV Player Quality of Life Improvements — v1.0

A standalone plugin for existing RPG Maker **MV** games. No Yanfly dependency. Not for MZ, VX Ace, or packed games whose JavaScript is inaccessible.

Made initially to fix a known refresh rate bug in RPGM games. Then modified walking speeds, then started vibe coding even more improvements...

## Controls and defaults

| Control / feature | Default |
| --- | --- |
| F7 | Cycle walking 1× → 2× → 3× → 1× |
| F6 | Cycle overall game speed 1× → 2× → 4× → 1× |
| H | Open/close dialogue history on map or in battle |
| History navigation | Up/Down, Page Up/Down, mouse wheel |
| Close history | H, Escape, or right click |
| Normal and slow scene fades | Instant |
| Event Fadeout/Fadein Screen | Instant, including corresponding event wait |
| Dialogue | Instant reveal; confirmation, choices and explicit scripted waits remain |
| MV database animations | 2× animation frame rate |
| Optional event fast-forward | Off; when enabled, stock hold-confirm fast-forward becomes 4× |
| Render freeze guard | Always on |

On some Macs use Fn+F7 / Fn+F6, or change the key codes. Hotkeys are observed without replacing MV's input mapping; existing game bindings can still conflict. A brief notice shows the selected speed. Walking/game speed reset to 1× on application restart, remain selected across saves/new games within that session, and are not stored in save files.

## Install into an existing deployed game

Close the game. Extract this entire folder somewhere convenient. Python **3.9+** is required only for the installer, not for gameplay. In a terminal opened in this extracted folder:

```sh
python3 install.py install "/path/to/Game" --dry-run
python3 install.py install "/path/to/Game"
```

The installer verifies MV's engine marker, copies PlayerQoL.js to `js/plugins/`, and registers/enables it **last** in `js/plugins.js`. e.g. `www/js/plugins/PlayerQoL.js`. 

Existing entries and their order are preserved; an existing PlayerQoL entry is updated and moved last without duplication. Its settings are preserved unless overridden. No engine patch is needed, and existing core freeze fixes remain intact. Save files are never edited.

The installer accepts the standard JSON-formatted MV registry with its usual leading comment and `var $plugins = ...;` wrapper. It refuses custom executable registry syntax instead of evaluating it. Use manual installation for custom formats. Dry-run does not create backups or modify files.

## Configuration

In an MV project, use Plugin Manager parameters. For deployed games use repeated `--set` arguments:

```sh
python3 install.py install "/path/to/Game" --set AnimationSpeed=3 --set SceneFadeFrames=6 --set EventFadeFrames=6
```

| Parameter | Values |
| --- | --- |
| SceneFadeFrames | -1 preserve game behavior; 0 instant; 1–600 frames |
| EventFadeFrames | -1 preserve game behavior; 0 instant; 1–600 frames |
| InstantDialogue | true / false |
| AnimationSpeed | 1–4; default 2; MV's integer animation interval limits precision |
| EventFastForward4x | true / false; default false |
| WalkKeyCode | 118 = F7 |
| SpeedKeyCode | 117 = F6 |
| HistoryKeyCode | 72 = H |
| HistoryLimit | 1–1000 message blocks; default 200 |

Use distinct hotkeys. For a conservative profile set both fade values to -1, InstantDialogue=false, AnimationSpeed=1 and leave optional event acceleration off. Walking and overall speed already start at 1×.

## Backups and restore

Before writing, the installer backs up both destination files (or records that the plugin did not previously exist) under the game's `PlayerQoL-backups/<timestamp>/`. It prints the exact folder. Keep that folder.

```sh
python3 install.py restore "/path/to/Game/www/PlayerQoL-backups/TIMESTAMP"
```

Restore refuses if either installed file has since changed, to avoid overwriting subsequent modifications. Restore repeat installations in reverse order. If needed, manually copy numbered backup files to the paths in `manifest.json`; a null backup means the file did not originally exist. Keep a separate copy of the game and saves before experimenting. Do not install or restore while the game is running. Do not interrupt a restore operation.

## Manual installation

Back up `js/plugins.js` and any existing `js/plugins/PlayerQoL.js`. Copy this plugin to `js/plugins/PlayerQoL.js`. In MV Plugin Manager add **PlayerQoL**, enable it and put it last. Without the editor, append this object inside the `$plugins` array, adding the necessary comma after the prior object:

```json
{"name":"PlayerQoL","status":true,"description":"Player QoL","parameters":{}}
```

Empty parameters use the defaults above. Keep the filename exactly `PlayerQoL.js`.

## References

- Official RPG Maker MV corescript freeze fix: https://github.com/rpgtkoolmv/corescript/pull/191 . The plugin wraps rather than replaces the engine renderer. 

