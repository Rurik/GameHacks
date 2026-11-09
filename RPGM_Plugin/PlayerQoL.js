/*:
 * @plugindesc v1.0 MV player comforts: speed keys, instant text/fades, history and render freeze guard.
 * @author OpenAI
 * @param SceneFadeFrames
 * @default 0
 * @param EventFadeFrames
 * @default 0
 * @param InstantDialogue
 * @default true
 * @param AnimationSpeed
 * @default 2
 * @param EventFastForward4x
 * @default false
 * @param WalkKeyCode
 * @default 118
 * @param SpeedKeyCode
 * @default 117
 * @param HistoryKeyCode
 * @default 72
 * @param HistoryLimit
 * @default 200
 * @help
 * MV only. Keep filename PlayerQoL.js. Place LAST in Plugin Manager.
 * F7: walk 1x/2x/3x. F6: game 1x/2x/4x. H: history.
 * History: arrows, PageUp/PageDown, mouse wheel; Escape/right click closes.
 * Frames: -1 preserves original; 0 instant. AnimationSpeed: 1..4.
 * Runtime controls reset on restart. History is session-only, cleared on new/load.
 * No Yanfly required. See README.md for installation and limitations.
 */
(function() {
    'use strict';
    if (window.PlayerQoL) return;
    var p = PluginManager.parameters('PlayerQoL');
    function num(k, d, lo, hi) {
        var v = p[k] === undefined || p[k] === '' ? d : Number(p[k]);
        return isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d;
    }
    var sceneFrames = num('SceneFadeFrames', 0, -1, 600);
    var eventFrames = num('EventFadeFrames', 0, -1, 600);
    var instant = p.InstantDialogue !== 'false';
    var animationSpeed = num('AnimationSpeed', 2, 1, 4);
    var event4 = p.EventFastForward4x === 'true';
    var limit = num('HistoryLimit', 200, 1, 1000);
    var walk = 1, speed = 1, history = [], pending = {};
    var keys = {};
    keys[num('WalkKeyCode',118,1,255)] = 'walk';
    keys[num('SpeedKeyCode',117,1,255)] = 'speed';
    keys[num('HistoryKeyCode',72,1,255)] = 'history';
    // Observe keys without replacing MV's key mapper or browser shortcuts.
    document.addEventListener('keydown', function(e) {
        if (!e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey && keys[e.keyCode]) {
            pending[keys[e.keyCode]] = true;
        }
    });
    window.addEventListener('blur', function() { pending = {}; });
    window.PlayerQoL = {version:'1.0', clearHistory:function(){history.length=0;}};
    // Record errors without suppressing MV's normal fatal-error handling.
    var crashPath = '';
    function logCrash(error) {
        try {
            var detail = error && error.stack ? String(error.stack) : String(error);
            var report = '\n=== PlayerQoL 1.0 ' + new Date().toISOString() + ' ===\n' +
                'Walk: ' + walk + 'x; game: ' + speed + 'x\n' +
                'Scene: ' + (SceneManager._scene && SceneManager._scene.constructor ?
                    SceneManager._scene.constructor.name : 'none') + '\n' +
                'Map: ' + (typeof $gameMap !== 'undefined' && $gameMap ? $gameMap.mapId() : '?') +
                '\n' + detail + '\n';
            if (typeof require !== 'function') return;
            var fs = require('fs'), path = require('path'), os = require('os');
            var dirs = [process.cwd(), os.tmpdir()];
            for (var j=0; j<dirs.length; j++) {
                try {
                    var target = path.join(dirs[j], 'PlayerQoL-crash.log');
                    if (fs.existsSync(target) && fs.statSync(target).size > 131072) {
                        fs.writeFileSync(target, report, 'utf8');
                    } else fs.appendFileSync(target, report, 'utf8');
                    crashPath = target;
                    break;
                } catch (writeError) { /* Try the temporary directory. */ }
            }
        } catch (loggingError) { /* Diagnostics must never replace the original error. */ }
    }
    var catchException = SceneManager.catchException;
    SceneManager.catchException = function(error) {
        logCrash(error);
        return catchException.apply(this, arguments);
    };
    var onError = SceneManager.onError;
    SceneManager.onError = function(event) {
        logCrash(event.error || (event.message + ' at ' + event.filename + ':' + event.lineno + ':' + event.colno));
        return onError.apply(this, arguments);
    };
    var printError = Graphics.printError;
    Graphics.printError = function(name, message) {
        if (crashPath) {
            // MV displays this as HTML; escape the diagnostic path.
            var safePath = crashPath.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            message = String(message) + '<br>Crash log: ' + safePath;
        }
        return printError.call(this, name, message);
    };
    // Some picture mappers may retain a Bitmap load listener after the
    // picture is erased. Its resetFrame then dereferences this.bitmap.width.
    // Only guard that specific plugin hook; let all other errors propagate.
    if (typeof Sprite_Picture !== 'undefined' &&
            typeof Sprite_Picture.prototype.resetFrame === 'function') {
        var pictureResetFrame = Sprite_Picture.prototype.resetFrame;
        Sprite_Picture.prototype.resetFrame = function() {
            if (!this.bitmap) return;
            return pictureResetFrame.apply(this, arguments);
        };
    }
    var render = Graphics.render;
    Graphics.render = function(stage) {
        if (this._skipCount < 0) this._skipCount = 0;
        return render.apply(this, arguments);
    };
    ['startFadeIn','startFadeOut'].forEach(function(k) {
        var original = Scene_Base.prototype[k];
        Scene_Base.prototype[k] = function(duration, white) {
            if (sceneFrames < 0) return original.apply(this, arguments);
            original.call(this, Math.max(1, sceneFrames), white);
            if (sceneFrames === 0) {
                this._fadeDuration = 0;
                this._fadeSprite.opacity = k === 'startFadeIn' ? 0 : 255;
            }
        };
    });
    ['fadeSpeed','slowFadeSpeed'].forEach(function(k) {
        var original = Scene_Base.prototype[k];
        Scene_Base.prototype[k] = function() {
            return sceneFrames < 0 ? original.apply(this, arguments) : sceneFrames;
        };
    });
    ['startFadeOut','startFadeIn'].forEach(function(k) {
        var original = Game_Screen.prototype[k];
        Game_Screen.prototype[k] = function(duration) {
            if (eventFrames < 0) return original.apply(this, arguments);
            original.call(this, Math.max(1,eventFrames));
            if (eventFrames === 0) {
                this._brightness = k === 'startFadeOut' ? 0 : 255;
                this._fadeOutDuration = this._fadeInDuration = 0;
            }
        };
    });
    // Match event interpreter waits to the replacement screen fade duration.
    [221,222].forEach(function(code) {
        var original = Game_Interpreter.prototype['command'+code];
        Game_Interpreter.prototype['command'+code] = function() {
            var ready = !$gameMessage.isBusy();
            var result = original.apply(this, arguments);
            if (ready && eventFrames >= 0) this._waitCount = eventFrames;
            return result;
        };
    });
    var distance = Game_Player.prototype.distancePerFrame;
    Game_Player.prototype.distancePerFrame = function() {
        var base = distance.apply(this, arguments);
        return !this.isInVehicle() && !this.isMoveRouteForcing() ? base * walk : base;
    };
    var showFast = Window_Message.prototype.updateShowFast;
    Window_Message.prototype.updateShowFast = function() {
        showFast.apply(this, arguments);
        if (instant) this._showFast = true;
    };
    var animInit = Sprite_Animation.prototype.setupRate;
    Sprite_Animation.prototype.setupRate = function() {
        animInit.apply(this, arguments);
        this._rate = Math.max(1, Math.round(this._rate / animationSpeed));
    };
    var multiply = Scene_Map.prototype.updateMainMultiply;
    Scene_Map.prototype.updateMainMultiply = function() {
        multiply.apply(this, arguments);
        if (event4 && this.isFastForward()) {
            this.updateMain();
            if (!SceneManager.isSceneChanging()) this.updateMain();
        }
    };
    // Capture resolved text once, when it starts displaying. Strip escapes for a
    // plain, inert history; never replay message control codes in the history UI.
    function plain(text) {
        return text.replace(/\x1bI\[\d+\]/gi,'[icon]')
            .replace(/\x1b[A-Z]+\[[^\]]*\]/gi,'')
            .replace(/\x1b[.!|^><{}$]/g,'').replace(/\x1b[A-Z]+/gi,'')
            .replace(/\x1b/g,'').replace(/\f/g,'\n');
    }
    var startMessage = Window_Message.prototype.startMessage;
    Window_Message.prototype.startMessage = function() {
        startMessage.apply(this, arguments);
        var text = plain(this.convertEscapeCharacters($gameMessage.allText()));
        if (text.trim()) { history.push(text.slice(0,16000)); if (history.length>limit) history.shift(); }
    };
    ['setupNewGame','extractSaveContents'].forEach(function(k) {
        var original = DataManager[k];
        DataManager[k] = function() { history.length=0; return original.apply(this,arguments); };
    });
    function HistoryWindow() { this.initialize.apply(this,arguments); }
    HistoryWindow.prototype = Object.create(Window_Selectable.prototype);
    HistoryWindow.prototype.constructor = HistoryWindow;
    HistoryWindow.prototype.initialize = function() {
        this._lines = [];
        Window_Selectable.prototype.initialize.call(this,0,0,Graphics.boxWidth,Graphics.boxHeight);
        var width = this.contentsWidth()-16;
        var self = this;
        history.forEach(function(entry,index) {
            self._lines.push('--- Message '+(index+1)+' ---');
            entry.split('\n').forEach(function(line) {
                var out='';
                Array.from(line).forEach(function(ch) {
                    if (out && self.textWidth(out+ch)>width) {self._lines.push(out);out='';}
                    out+=ch;
                });
                self._lines.push(out);
            });
            self._lines.push('');
        });
        if (!this._lines.length) this._lines.push('No dialogue recorded yet.');
        this.refresh(); this.select(this._lines.length-1); this.activate();
    };
    HistoryWindow.prototype.maxItems = function(){return this._lines ? this._lines.length : 0;};
    HistoryWindow.prototype.drawItem = function(index) {
        var r=this.itemRectForText(index);
        this.drawText(this._lines[index],r.x,r.y,r.width,'left');
    };
    function usable(scene) {
        return scene && (scene instanceof Scene_Map || scene instanceof Scene_Battle) &&
            !SceneManager.isSceneChanging() && !scene.isBusy();
    }
    var updateScene = SceneManager.updateScene;
    SceneManager.updateScene = function() {
        var scene=this._scene;
        if (scene && scene._qolHistory) {
            if (pending.history || Input.isTriggered('cancel') || TouchInput.isCancelled()) {
                var w=scene._qolHistory; scene.removeChild(w); scene._qolHistory=null;
                if (w.destroy) w.destroy({children:true,texture:false,baseTexture:false});
                Input.clear(); TouchInput.clear(); pending={};
            } else scene._qolHistory.update();
            return;
        }
        if (scene && (scene instanceof Scene_Map || scene instanceof Scene_Battle) &&
                !SceneManager.isSceneChanging()) {
            if (pending.walk) {walk=walk===3?1:walk+1; scene._qolNotice='Walk '+walk+'x';}
            if (pending.speed) {speed=speed===1?2:speed===2?4:1;scene._qolNotice='Game '+speed+'x';}
            if (pending.history) {
                scene._qolHistory=new HistoryWindow(); scene.addChild(scene._qolHistory);
                Input.clear(); TouchInput.clear(); pending={}; return;
            }
            if (scene._qolNotice) {
                if (!scene._qolToast) {
                    scene._qolToast=new Sprite(new Bitmap(250,40));
                    scene.addChild(scene._qolToast);
                }
                var b=scene._qolToast.bitmap; b.clear();b.fillRect(0,0,250,40,'rgba(0,0,0,0.8)');
                b.fontSize=22;b.drawText(scene._qolNotice,8,0,234,40,'left');
                scene._qolToast.opacity=255;scene._qolToastTime=90;scene._qolNotice=null;
            }
        }
        pending={};
        var count=usable(scene)?speed:1;
        for(var i=0;i<count;i++) {
            updateScene.apply(this,arguments);
            if(this._scene!==scene || this.isSceneChanging()) break;
        }
        if(scene && scene._qolToast && --scene._qolToastTime<=0) scene._qolToast.opacity=0;
    };
})();
