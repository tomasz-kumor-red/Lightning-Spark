import fs from "fs";
import http from "http";
import https from "https";

export class SparkMediaplayer extends lng.Component {

    _construct(){
        this._skipRenderToTexture = false;
    }

    static _supportedEvents()
    {
        return ['onProgressUpdate', 'onEndOfStream'];
    }

    static _template() {
        return {
            Video: {
                VideoWrap: {
                    VideoTexture: {
                        visible: false,
                        pivot: 0.5,
                        texture: {type: lng.textures.StaticTexture, options: {}}
                    }
                }
            }
        };
    }

    set skipRenderToTexture (v) {
        this._skipRenderToTexture = v;
    }

    set textureMode(v) {
        return this._textureMode = v;
    }

    get textureMode() {
        return this._textureMode;
    }

    get videoView() {
        return this.tag("Video");
    }

    _init() {

        this.videoEl = sparkscene.create({
            t: "video",
            id: "video-player",
            autoPlay: "false"
        });

        this.eventHandlers = [];
    }

    _registerListeners() {
        SparkMediaplayer._supportedEvents().forEach(event => {
            const handler = (e) => {
                this.fire(event, {videoElement: this.videoEl, event: e});
            };
            this.eventHandlers.push(handler);
            this.videoEl.on(event, handler);
        });
    }

    _deregisterListeners() {
        SparkMediaplayer._supportedEvents().forEach((event, index) => {
            this.videoEl.delListener(event, this.eventHandlers[index]);
        });
        this.eventHandlers = [];
    }

    _attach() {
        this._registerListeners();
    }

    _detach() {
        this._deregisterListeners();
    }

    updateSettings(settings = {}) {
        // The Component that 'consumes' the media player.
        this._consumer = settings.consumer;

        if (this._consumer && this._consumer.getMediaplayerSettings) {
            // Allow consumer to add settings.
            settings = Object.assign(settings, this._consumer.getMediaplayerSettings());
        }

        if (!lng.Utils.equalValues(this._stream, settings.stream)) {
            if (settings.stream && settings.stream.keySystem) {
                navigator.requestMediaKeySystemAccess(settings.stream.keySystem.id, settings.stream.keySystem.config).then((keySystemAccess) => {
                    return keySystemAccess.createMediaKeys();
                }).then((createdMediaKeys) => {
                    return this.videoEl.setMediaKeys(createdMediaKeys);
                }).then(() => {
                    if (settings.stream && settings.stream.src)
                        this.open(settings.stream.src);
                }).catch(() => {
                    console.error('Failed to set up MediaKeys');
                });
            } else if (settings.stream && settings.stream.src) {
                this.open(settings.stream.src);
                this._setHide(settings.hide);
                this._setVideoArea(settings.videoPos);
                this.doPlay();
            } else {
                this.close();
            }
            this._stream = settings.stream;
        }
    }

    _setHide(hide) {
        this.videoEl.a = hide ? 0 : 1;
    }

    open(url) {
        url = "http://ccr.ip-ads.xcr.comcast.net/omg04/354092102255/nbcuni.comNBCU2019012500009006/HD_VOD_DAI_XFS09004000H_0125_LVLH03.mpd"; // hardcoded URL
        console.log('Playing stream', url);
        if (this.application.noVideo) {
            console.log('noVideo option set, so ignoring: ' + url);
            return;
        }
        if (this.videoEl.url === url) return this.reload();
        this.videoEl.url = url;
    }

    close() {
        this.videoEl.stop();
        this._clearSrc();
    }

    playPause() {
        if (this.isPlaying()) {
            this.doPause();
        } else {
            this.doPlay();
        }
    }

    isPlaying() {
        return (this._getState() === "Playing");
    }

    doPlay() {
        this.videoEl.play();
    }

    doPause() {
        this.videoEl.pause();
    }

    reload() {
        var url = this.videoEl.url;
        this.close();
        this.videoEl.url = url;
    }

    getPosition() {
        return Promise.resolve(this.videoEl.position);
    }

    setPosition(pos) {
        this.videoEl.position = pos;
    }

    getDuration() {
        return Promise.resolve(this.videoEl.duration);
    }

    seek(time, absolute = false) {
        if(absolute) {
            this.videoEl.position = time;
        }
        else {
            this.videoEl.setPositionRelative(time);
        }
    }

    _setVideoArea(videoPos) {
        if (lng.Utils.equalValues(this._videoPos, videoPos)) {
            return;
        }

        this._videoPos = videoPos;

        if (this.textureMode) {
            this.videoTextureView.patch({
                smooth: {
                    x: videoPos[0],
                    y: videoPos[1],
                    w: videoPos[2] - videoPos[0],
                    h: videoPos[3] - videoPos[1]
                }
            });
        } else {
            const precision = this.stage.getRenderPrecision();
            this.videoEl.x = Math.round(videoPos[0] * precision) + 'px';
            this.videoEl.y = Math.round(videoPos[1] * precision) + 'px';
            this.videoEl.w = Math.round((videoPos[2] - videoPos[0]) * precision) + 'px';
            this.videoEl.h = Math.round((videoPos[3] - videoPos[1]) * precision) + 'px';
        }
    }

    _fireConsumer(event, args) {
        if (this._consumer) {
            this._consumer.fire(event, args);
        }
    }

    _equalInitData(buf1, buf2) {
        if (!buf1 || !buf2) return false;
        if (buf1.byteLength != buf2.byteLength) return false;
        const dv1 = new Int8Array(buf1);
        const dv2 = new Int8Array(buf2);
        for (let i = 0 ; i != buf1.byteLength ; i++)
            if (dv1[i] != dv2[i]) return false;
        return true;
    }

    error(args) {
        this._fireConsumer('$mediaplayerError', args);
        this._setState("");
        return "";
    }

    loadeddata(args) {
        this._fireConsumer('$mediaplayerLoadedData', args);
    }

    play(args) {
        this._fireConsumer('$mediaplayerPlay', args);
    }

    playing(args) {
        this._fireConsumer('$mediaplayerPlaying', args);
        this._setState("Playing");
    }

    canplay(args) {
        this.videoEl.play();
        this._fireConsumer('$mediaplayerStart', args);
    }

    loadstart(args) {
        this._fireConsumer('$mediaplayerLoad', args);
    }

    seeked(args) {
        this._fireConsumer('$mediaplayerSeeked', {
            currentTime: this.videoEl.position,
            duration: this.videoEl.duration || 1
        });
    }

    seeking(args) {
        this._fireConsumer('$mediaplayerSeeking', {
            currentTime: this.videoEl.position,
            duration: this.videoEl.duration || 1
        });
    }

    onEndOfStream(args) {
        this._fireConsumer('$mediaplayerEnded', args);
        this._setState("");
    }

    onProgressUpdate(args) {
        this._fireConsumer('$mediaplayerProgress', {
            currentTime: this.videoEl.position,
            duration: this.videoEl.duration || 1
        });
    }

    durationchange(args) {
        this._fireConsumer('$mediaplayerDurationChange', args);
    }

    encrypted(args) {
        const video = args.videoElement;
        const event = args.event;
        // FIXME: Double encrypted events need to be properly filtered by Gstreamer
        if (video.mediaKeys && !this._equalInitData(this._previousInitData, event.initData)) {
            this._previousInitData = event.initData;
            this._fireConsumer('$mediaplayerEncrypted', args);
        }
    }

    static _states() {
        return [
            class Playing extends this {
                $enter() {
                    this._startUpdatingVideoTexture();
                }
                $exit() {
                    this._stopUpdatingVideoTexture();
                }
                pause(args) {
                    this._fireConsumer('$mediaplayerPause', args);
                    this._setState("Playing.Paused");
                }
                _clearSrc() {
                    this._fireConsumer('$mediaplayerStop', {});
                    this._setState("");
                }
                static _states() {
                    return [
                        class Paused extends this {
                        }
                    ]
                }
            }
        ]
    }

}


export default class SparkPlatform {

    init(stage) {
        this.stage = stage;
        this._looping = false;
        this._awaitingLoop = false;
        this._sparkCanvas = null;
    }

    destroy() {
    }

    startLoop() {
        this._looping = true;
        if (!this._awaitingLoop) {
            this.loop();
        }
    }

    stopLoop() {
        this._looping = false;
    }

    loop() {
        let self = this;
        let lp = function() {
            self._awaitingLoop = false;
            if (self._looping) {
                self.stage.drawFrame();
                if (self.changes) {
                    // We depend on blit to limit to 60fps.
                    setImmediate(lp);
                } else {
                    setTimeout(lp, 32);
                }
                self._awaitingLoop = true;
            }
        }
        setTimeout(lp, 32);
    }

    uploadGlTexture(gl, textureSource, source, options) {
        gl.texImage2D(gl.TEXTURE_2D, 0, options.internalFormat, textureSource.w, textureSource.h, 0, options.format, options.type, source);
    }

    loadSrcTexture({src}, cb) {
        let sparkImage = sparkscene.create({t:"image", url:src});
        const sparkGl = this.stage.gl;
        sparkImage.ready.then( function(obj) {
            let texture = sparkImage.texture();
            cb(null, {source: sparkGl.createWebGLTexture(texture), w: sparkImage.resource.w, h: sparkImage.resource.h, premultiplyAlpha: false, flipBlueRed: false, imageRef: sparkImage, flipTextureY:true});
        });
    }

    createRoundRect(cb, stage, w, h, radius, strokeWidth, strokeColor, fill, fillColor) {
        if (fill === undefined) fill = true;
        if (strokeWidth === undefined) strokeWidth = 0;
        if (fillColor === undefined) fillColor = 0;

        fillColor = fill ? fillColor : 0;
        fillColor = fillColor.toString(16);
        let opacity = 1;
        if (fillColor.length >= 8)
        {
            let alpha = fillColor.substring(0,2);
            let red = fillColor.substring(2,4);
            let green = fillColor.substring(4,6);
            let blue = fillColor.substring(6);
            fillColor = "#" + red + green + blue;
            opacity = "0x"+alpha;
            opacity = parseInt(opacity, 16) / 255;
        }
        let boundW = w+strokeWidth;
        let boundH = h+strokeWidth;
        let data = "data:image/svg,"+
          `<svg viewBox="0 0 ${boundW} ${boundH}" xmlns="http://www.w3.org/2000/svg">` +
          `<rect x="${strokeWidth/2}" y="${strokeWidth/2}" width="${w}" height="${h}" fill="${fillColor}" fill-opacity="${opacity}" rx="${radius}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>` +
          '</svg>';

        let imageObj = sparkscene.create({ t: "image", url:data});
        imageObj.ready.then( function(obj) {
            let canvas = {};
            canvas.flipTextureY = true;
            canvas.internal = imageObj;
            canvas.width = w;
            canvas.height = h;
            imageObj.w = w;
            imageObj.h = h;
            cb(null, canvas);
        });
    }

    createShadowRect(cb, stage, w, h, radius, blur, margin) {
        let boundW = w + margin * 2;
        let boundH = h + margin * 2;
        let data = "data:image/svg,"+
            '<svg viewBox="0 0 '+boundW+' '+boundH+'" xmlns="http://www.w3.org/2000/svg" version="1.1"> \
                    <linearGradient id="rectGradient" gradientUnits="userSpaceOnUse" x1="0%" y1="180%" x2="100%" y2="-60%" gradientTransform="rotate(0)"> \
                    <stop offset="20%" stop-color="#00FF00" stop-opacity="0.5"/> \
                    <stop offset="50%" stop-color="#0000FF" stop-opacity=".8"/> \
                    <stop offset="80%" stop-color="#00FF00" stop-opacity=".5"/> \
                    </linearGradient> \
                    <filter id="rectBlur" x="0" y="0"> \
                    <feGaussianBlur in="SourceGraphic" stdDeviation="'+blur+'" /> \
                    </filter> \
                </defs> \
                <g enable-background="new" > \
                    <rect x="0" y="0" width="'+boundW+'" height="'+boundH+'" fill="url(#rectGradient)"  rx="'+radius+'" stroke-width="'+margin+'" filter="url(#rectBlur)"/> \
                </g> \
                </svg>';

        let imageObj = sparkscene.create({ t: "image", url:data});
        imageObj.ready.then( function(obj) {
            let canvas = {};
            canvas.flipTextureY = true;
            canvas.internal = imageObj;
            canvas.width = w;
            canvas.height = h;
            imageObj.w = w;
            imageObj.h = h;
            cb(null, canvas);
        });
    }

    createSvg(cb, stage, url, w, h) {
        let imageObj = sparkscene.create({ t: "image", url:url});
        imageObj.ready.then( function(obj) {
            let canvas = {};
            canvas.flipTextureY = true;
            canvas.internal = imageObj;
            canvas.width = w;
            canvas.height = h;
            imageObj.w = w;
            imageObj.h = h;
            cb(null, canvas);
        }, function(obj) {
            let canvas = {};
            canvas.internal = imageObj;
            cb(null, canvas);;
        });
    }

    createWebGLContext(w, h) {
        let options = {width: w, height: h, title: "WebGL"};
        const windowOptions = this.stage.getOption('window');
        if (windowOptions) {
            options = Object.assign(options, windowOptions);
        }
        let gl = sparkgles2.init(options);
        return gl;
    }

    getWebGLCanvas() {
        return;
    }

    getTextureOptionsForDrawingCanvas(canvas) {
        let options = {};

        if (canvas && canvas.internal)
        {
            options.source = this.stage.gl.createWebGLTexture(canvas.internal.texture());
            options.w = canvas.width;
            options.h = canvas.height;
            options.imageRef = canvas.internal;
            if (canvas.flipTextureY) {
                options.flipTextureY = true;
            }
        }
        options.premultiplyAlpha = false;
        options.flipBlueRed = false;
        return options;
    }

    getHrTime() {
        let hrTime = process.hrtime();
        return 1e3 * hrTime[0] + (hrTime[1] / 1e6);
    }

    getDrawingCanvas() {
        let sparkCanvas;
        let reuse = false; // We don't reuse this canvas because textures may load async.
        if (!reuse) {
            this._sparkCanvas = null;
        }
        if (this._sparkCanvas === null) {
            sparkCanvas = {};
            sparkCanvas.internal = sparkscene.create({t: "textCanvas"});
            sparkCanvas.internal.colorMode = "ARGB";
            this._sparkCanvas = sparkCanvas;
            this._sparkCanvas.getContext = function() {
                return sparkCanvas.internal;
            }
        }
        return this._sparkCanvas;
    }

    nextFrame(changes) {
        this.changes = changes;
        if (this.stage && this.stage.gl) {
            this.stage.gl.scissor(0,0,0,0);
        }
        //gles2.nextFrame(changes);
    }

    registerKeyHandler(keyhandler) {
        console.warn("No support for key handling");
    }

    drawText(textTextureRenderer) {
        let canvasInternal = textTextureRenderer._canvas.internal; // _canvas.internal is a pxTextCanvas object created in getDrawingCanvas()
        let drawPromise = new Promise((resolve, reject) => {
            canvasInternal.ready.then( () => { // waiting for the empty scene
                canvasInternal.parent = sparkscene.root;
                textTextureRenderer.setFontProperties();
                canvasInternal.font.ready.then(() => { // the font might have been coerced
                    canvasInternal.pixelSize = textTextureRenderer._settings.fontSize * textTextureRenderer.getPrecision();
                    // Original Lightining code with some changes begins here
                    // Changes to the original code are:
                    // Replaced:  `this.` => `textTextureRenderer.`
                    // Replaced `StageUtils.getRgbaString(color)` => `color`
                    // Replaced `this._canvas.width` => `canvasInternal.width` and `this._canvas.height` => `canvasInternal.height` after the line: // Add extra margin to prevent issue with clipped text when scaling.
                    // setFontProperties() calls are commented out as redundant
                    // Setting canvas label to faciliatate debugging (this is optional and can be removed):
                    // canvasInternal.label = textTextureRenderer._settings.text.slice(0, 10) + '..';
                    let renderInfo = {};
                    const precision = textTextureRenderer.getPrecision();
                    let paddingLeft = textTextureRenderer._settings.paddingLeft * precision;
                    let paddingRight = textTextureRenderer._settings.paddingRight * precision;
                    const fontSize = textTextureRenderer._settings.fontSize * precision;
                    let offsetY = textTextureRenderer._settings.offsetY === null ? null : (textTextureRenderer._settings.offsetY * precision);
                    let lineHeight = textTextureRenderer._settings.lineHeight * precision;
                    const w = textTextureRenderer._settings.w * precision;
                    const h = textTextureRenderer._settings.h * precision;
                    let wordWrapWidth = textTextureRenderer._settings.wordWrapWidth * precision;
                    const cutSx = textTextureRenderer._settings.cutSx * precision;
                    const cutEx = textTextureRenderer._settings.cutEx * precision;
                    const cutSy = textTextureRenderer._settings.cutSy * precision;
                    const cutEy = textTextureRenderer._settings.cutEy * precision;

                    canvasInternal.label = textTextureRenderer._settings.text.slice(0, 10) + '..'; // allows to distinguish different canvases by label, useful for debugging
                    // Set font properties.
                    // textTextureRenderer.setFontProperties();
                    // Total width.
                    let width = w || (2048 / textTextureRenderer.getPrecision());
                    // Inner width.
                    let innerWidth = width - (paddingLeft);
                    if (innerWidth < 10) {
                        width += (10 - innerWidth);
                        innerWidth += (10 - innerWidth);
                    }
                    if (!wordWrapWidth) {
                        wordWrapWidth = innerWidth;
                    }
                    // word wrap
                    // preserve original text
                    let linesInfo;
                    if (textTextureRenderer._settings.wordWrap) {
                        linesInfo = textTextureRenderer.wrapText(textTextureRenderer._settings.text, wordWrapWidth);
                    } else {
                        linesInfo = {l: textTextureRenderer._settings.text.split(/(?:\r\n|\r|\n)/), n: []};
                        let n = linesInfo.l.length;
                        for (let i = 0; i < n - 1; i++) {
                            linesInfo.n.push(i);
                        }
                    }
                    let lines = linesInfo.l;
                    if (textTextureRenderer._settings.maxLines && lines.length > textTextureRenderer._settings.maxLines) {
                        let usedLines = lines.slice(0, textTextureRenderer._settings.maxLines);
                        let otherLines = null;
                        if (textTextureRenderer._settings.maxLinesSuffix) {
                            // Wrap again with max lines suffix enabled.
                            let w = textTextureRenderer._settings.maxLinesSuffix ? textTextureRenderer._context.measureText(textTextureRenderer._settings.maxLinesSuffix).width : 0;
                            let al = textTextureRenderer.wrapText(usedLines[usedLines.length - 1], wordWrapWidth - w);
                            usedLines[usedLines.length - 1] = al.l[0] + textTextureRenderer._settings.maxLinesSuffix;
                            otherLines = [al.l.length > 1 ? al.l[1] : ''];
                        } else {
                            otherLines = [''];
                        }
                        // Re-assemble the remaining text.
                        let i, n = lines.length;
                        let j = 0;
                        let m = linesInfo.n.length;
                        for (i = textTextureRenderer._settings.maxLines; i < n; i++) {
                            otherLines[j] += (otherLines[j] ? " " : "") + lines[i];
                            if (i + 1 < m && linesInfo.n[i + 1]) {
                                j++;
                            }
                        }
                        renderInfo.remainingText = otherLines.join("\n");
                        renderInfo.moreTextLines = true;
                        lines = usedLines;
                    } else {
                        renderInfo.moreTextLines = false;
                        renderInfo.remainingText = "";
                    }
                    // calculate text width
                    let maxLineWidth = 0;
                    let lineWidths = [];
                    for (let i = 0; i < lines.length; i++) {
                        let lineWidth = textTextureRenderer._context.measureText(lines[i]).width;
                        lineWidths.push(lineWidth);
                        maxLineWidth = Math.max(maxLineWidth, lineWidth);
                    }
                    renderInfo.lineWidths = lineWidths;
                    if (!w) {
                        // Auto-set width to max text length.
                        width = maxLineWidth + paddingLeft + paddingRight;
                        innerWidth = maxLineWidth;
                    }
                    // calculate text height
                    lineHeight = lineHeight || fontSize;
                    let height;
                    if (h) {
                        height = h;
                    } else {
                        height = lineHeight * (lines.length - 1) + 0.5 * fontSize + Math.max(lineHeight, fontSize) + offsetY;
                    }
                    if (offsetY === null) {
                        offsetY = fontSize;
                    }
                    renderInfo.w = width;
                    renderInfo.h = height;
                    renderInfo.lines = lines;
                    renderInfo.precision = precision;
                    if (!width) {
                        // To prevent canvas errors.
                        width = 1;
                    }
                    if (!height) {
                        // To prevent canvas errors.
                        height = 1;
                    }
                    if (cutSx || cutEx) {
                        width = Math.min(width, cutEx - cutSx);
                    }
                    if (cutSy || cutEy) {
                        height = Math.min(height, cutEy - cutSy);
                    }
                    // Add extra margin to prevent issue with clipped text when scaling.
                    canvasInternal.width = Math.ceil(width + textTextureRenderer._stage.getOption('textRenderIssueMargin'));
                    canvasInternal.height = Math.ceil(height);
                    // Canvas context has been reset.
                    // textTextureRenderer.setFontProperties();
                    if (fontSize >= 128) {
                        // WpeWebKit bug: must force compositing because cairo-traps-compositor will not work with text first.
                        textTextureRenderer._context.globalAlpha = 0.01;
                        textTextureRenderer._context.fillRect(0, 0, 0.01, 0.01);
                        textTextureRenderer._context.globalAlpha = 1.0;
                    }
                    if (cutSx || cutSy) {
                        textTextureRenderer._context.translate(-cutSx, -cutSy);
                    }
                    let linePositionX;
                    let linePositionY;
                    let drawLines = [];
                    // Draw lines line by line.
                    for (let i = 0, n = lines.length; i < n; i++) {
                        linePositionX = 0;
                        linePositionY = (i * lineHeight) + offsetY;
                        if (textTextureRenderer._settings.textAlign === 'right') {
                            linePositionX += (innerWidth - lineWidths[i]);
                        } else if (textTextureRenderer._settings.textAlign === 'center') {
                            linePositionX += ((innerWidth - lineWidths[i]) / 2);
                        }
                        linePositionX += paddingLeft;
                        drawLines.push({text: lines[i], x: linePositionX, y: linePositionY, w: lineWidths[i]});
                    }
                    // Highlight.
                    if (textTextureRenderer._settings.highlight) {
                        let color = textTextureRenderer._settings.highlightColor || 0x00000000;
                        let hlHeight = (textTextureRenderer._settings.highlightHeight * precision || fontSize * 1.5);
                        let offset = (textTextureRenderer._settings.highlightOffset !== null ? textTextureRenderer._settings.highlightOffset * precision : -0.5 * fontSize);
                        const hlPaddingLeft = (textTextureRenderer._settings.highlightPaddingLeft !== null ? textTextureRenderer._settings.highlightPaddingLeft * precision : paddingLeft);
                        const hlPaddingRight = (textTextureRenderer._settings.highlightPaddingRight !== null ? textTextureRenderer._settings.highlightPaddingRight * precision : paddingRight);

                        textTextureRenderer._context.fillStyle = color;
                        for (let i = 0; i < drawLines.length; i++) {
                            let drawLine = drawLines[i];
                            textTextureRenderer._context.fillRect((drawLine.x - hlPaddingLeft), (drawLine.y + offset), (drawLine.w + hlPaddingRight + hlPaddingLeft), hlHeight);
                        }
                    }
                    // Text shadow.
                    let prevShadowSettings = null;
                    if (textTextureRenderer._settings.shadow) {
                        prevShadowSettings = [textTextureRenderer._context.shadowColor, textTextureRenderer._context.shadowOffsetX, textTextureRenderer._context.shadowOffsetY, textTextureRenderer._context.shadowBlur];
                        textTextureRenderer._context.shadowColor = textTextureRenderer._settings.shadowColor;
                        textTextureRenderer._context.shadowOffsetX = textTextureRenderer._settings.shadowOffsetX * precision;
                        textTextureRenderer._context.shadowOffsetY = textTextureRenderer._settings.shadowOffsetY * precision;
                        textTextureRenderer._context.shadowBlur = textTextureRenderer._settings.shadowBlur * precision;
                    }
                    textTextureRenderer._context.fillStyle = textTextureRenderer._settings.textColor;
                    for (let i = 0, n = drawLines.length; i < n; i++) {
                        let drawLine = drawLines[i];
                        textTextureRenderer._context.fillText(drawLine.text, drawLine.x, drawLine.y);
                    }

                    if (prevShadowSettings) {
                        textTextureRenderer._context.shadowColor = prevShadowSettings[0];
                        textTextureRenderer._context.shadowOffsetX = prevShadowSettings[1];
                        textTextureRenderer._context.shadowOffsetY = prevShadowSettings[2];
                        textTextureRenderer._context.shadowBlur = prevShadowSettings[3];
                    }

                    if (cutSx || cutSy) {
                        textTextureRenderer._context.translate(cutSx, cutSy);
                    }
                    // Original Lightining code ends here
                    canvasInternal.ready.then(() => { // everything is drawn
                        renderInfo.w = canvasInternal.w;
                        renderInfo.h = canvasInternal.h;
                        textTextureRenderer._canvas.width = canvasInternal.w;
                        textTextureRenderer._canvas.height = canvasInternal.h;
                        textTextureRenderer.renderInfo = renderInfo;
                        resolve();
                    });
                });
            });
        });
        return drawPromise;
    }

    loadFonts(fonts) {
        let promises = [];
        let fontResources = new Map();
        for (let font of fonts) {
            let fontResource = sparkscene.create({t: "fontResource", url: font.url});
            promises.push(fontResource.ready);
            fontResources.set(font.family, fontResource);
        }

        // load fonts and then store a
        // reference to them so they can be used
        // in getFontSetting calls
        Promise.all(promises)
            .then(() => this._fontResources = fontResources);

        // continue to return promise/font object
        // to maintain compatibility with SDK client
        return {
            promises: promises,
            fontResources: fontResources
        };
    }

    getFontSetting(textTextureRenderer) {
        let fontResource = textTextureRenderer._context.font;
        let fontFace = textTextureRenderer._settings.fontFace;
        let fontStyle = textTextureRenderer._settings.fontStyle.toLowerCase();

        if (this._fontResources !== undefined && this._fontResources.has(fontFace)) {
            fontResource = this._fontResources.get(fontFace);
            if (fontResource.needsStyleCoercion(fontStyle)) {
                let url = fontResource.url;
                fontResource = sparkscene.create({t: "fontResource", url: url, fontStyle: fontStyle});
            }
        }
        return fontResource;
    }
}

