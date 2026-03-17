// ConnectDots - Core drawing engine
// A dot-grid drawing activity where kids connect dots to form colored shapes

define([], function () {

	var COLORS = ['#FF4444', '#FF9800', '#FFEB3B', '#4CAF50', '#2196F3', '#9C27B0', '#FF69B4', '#795548'];

	// Grid config
	var GRID_COLS = 12;
	var GRID_ROWS = 8;
	var DOT_RADIUS = 7;
	var DOT_HOVER_RADIUS = 14;
	var SNAP_RADIUS = 30;
	var LINE_WIDTH = 4;
	var DOT_COLOR = '#8B7355';
	var DOT_HOVER_COLOR = '#FFFFFF';
	var BG_COLOR = '#b8956a';

	// State
	var canvas, ctx;
	var dots = [];              // [{x, y, row, col}, ...]
	var completedShapes = [];   // [{dotIndices: [...], color: string}, ...]
	var currentPath = [];       // [dotIndex, dotIndex, ...]
	var currentColor = COLORS[0];
	var hoveredDot = -1;
	var cursorX = -1, cursorY = -1;
	var undoStack = [];         // [{type: 'shape', data: {...}} or {type: 'line', data: [...]}]
	var isFullscreen = false;
	var animationId = null;
	var remotePaths = [];       // [{userId: string, path: [dotIndex, ...], color: string}]

	// Dot animation state
	var dotScales = [];         // current animation scale per dot (0..1 where 1 = fully hovered)
	var DOT_ANIM_SPEED = 0.12;

	// Sharing callback (set externally)
	var onAction = null;

	function init(canvasEl) {
		canvas = canvasEl;
		ctx = canvas.getContext('2d');
		resize();
		setupEvents();
		startRenderLoop();
	}

	function resize() {
		var container = canvas.parentElement;
		var dpr = window.devicePixelRatio || 1;
		var w = container.clientWidth;
		var h = container.clientHeight;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		canvas.style.width = w + 'px';
		canvas.style.height = h + 'px';
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		computeDots(w, h);
	}

	function computeDots(w, h) {
		dots = [];
		dotScales = [];
		var padX = 60;
		var padY = 40;
		var spacingX = (w - 2 * padX) / (GRID_COLS - 1);
		var spacingY = (h - 2 * padY) / (GRID_ROWS - 1);
		for (var r = 0; r < GRID_ROWS; r++) {
			for (var c = 0; c < GRID_COLS; c++) {
				dots.push({
					x: padX + c * spacingX,
					y: padY + r * spacingY,
					row: r,
					col: c
				});
				dotScales.push(0);
			}
		}
	}

	function setupEvents() {
		// Detect touch
		var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

		if (isTouchDevice) {
			canvas.addEventListener('touchstart', function (e) {
				e.preventDefault();
				var touch = e.touches[0];
				var pos = getCanvasPos(touch.clientX, touch.clientY);
				cursorX = pos.x;
				cursorY = pos.y;
				hoveredDot = findNearestDot(pos.x, pos.y);
				handleTap(pos.x, pos.y);
			}, { passive: false });
			canvas.addEventListener('touchmove', function (e) {
				e.preventDefault();
				var touch = e.touches[0];
				var pos = getCanvasPos(touch.clientX, touch.clientY);
				cursorX = pos.x;
				cursorY = pos.y;
				hoveredDot = findNearestDot(pos.x, pos.y);
			}, { passive: false });
			canvas.addEventListener('touchend', function (e) {
				e.preventDefault();
				hoveredDot = -1;
				cursorX = -1;
				cursorY = -1;
			}, { passive: false });
		}

		// Always add mouse events (for desktop or hybrid devices)
		canvas.addEventListener('mousedown', function (e) {
			var pos = getCanvasPos(e.clientX, e.clientY);
			handleTap(pos.x, pos.y);
		});
		canvas.addEventListener('mousemove', function (e) {
			var pos = getCanvasPos(e.clientX, e.clientY);
			cursorX = pos.x;
			cursorY = pos.y;
			hoveredDot = findNearestDot(pos.x, pos.y);
		});
		canvas.addEventListener('mouseleave', function () {
			hoveredDot = -1;
			cursorX = -1;
			cursorY = -1;
		});

		window.addEventListener('resize', function () {
			resize();
		});
	}

	function getCanvasPos(clientX, clientY) {
		var rect = canvas.getBoundingClientRect();
		return {
			x: clientX - rect.left,
			y: clientY - rect.top
		};
	}

	function findNearestDot(x, y) {
		var bestIdx = -1;
		var bestDist = SNAP_RADIUS;
		for (var i = 0; i < dots.length; i++) {
			var dx = dots[i].x - x;
			var dy = dots[i].y - y;
			var dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < bestDist) {
				bestDist = dist;
				bestIdx = i;
			}
		}
		return bestIdx;
	}

	function handleTap(x, y) {
		var dotIdx = findNearestDot(x, y);
		if (dotIdx === -1) return;

		if (currentPath.length === 0) {
			// Start new path
			currentPath.push(dotIdx);
			if (onAction) {
				onAction({ type: 'startPath', dot: dotIdx, color: currentColor });
			}
			return;
		}

		// If tapping the same dot as the last one, ignore
		if (dotIdx === currentPath[currentPath.length - 1]) return;

		// If tapping back to the start dot and we have at least 3 dots, close the shape
		if (dotIdx === currentPath[0] && currentPath.length >= 3) {
			var shape = { dotIndices: currentPath.slice(), color: currentColor };
			completedShapes.push(shape);
			undoStack.push({ type: 'shape', data: shape });
			if (onAction) {
				onAction({ type: 'closeShape', dotIndices: shape.dotIndices, color: shape.color });
			}
			currentPath = [];
			return;
		}

		// If dot is already in the path (not start), ignore to prevent crossing
		for (var i = 1; i < currentPath.length; i++) {
			if (currentPath[i] === dotIdx) return;
		}

		// Add dot to the current path
		var fromDot = currentPath[currentPath.length - 1];
		currentPath.push(dotIdx);
		if (onAction) {
			onAction({ type: 'addLine', from: fromDot, to: dotIdx, color: currentColor });
		}
	}

	// --- Rendering ---

	function startRenderLoop() {
		function loop() {
			update();
			render();
			animationId = requestAnimationFrame(loop);
		}
		animationId = requestAnimationFrame(loop);
	}

	function update() {
		// Animate dot scales
		for (var i = 0; i < dots.length; i++) {
			if (i === hoveredDot) {
				dotScales[i] = Math.min(1, dotScales[i] + DOT_ANIM_SPEED);
			} else {
				dotScales[i] = Math.max(0, dotScales[i] - DOT_ANIM_SPEED);
			}
		}
	}

	function render() {
		var w = canvas.width / (window.devicePixelRatio || 1);
		var h = canvas.height / (window.devicePixelRatio || 1);

		// Clear and draw improved background
		ctx.clearRect(0, 0, w, h);
		drawBackground(w, h);

		// 1. Draw completed shapes (filled)
		for (var i = 0; i < completedShapes.length; i++) {
			drawFilledShape(completedShapes[i]);
		}

		// 2. Draw completed shape outlines
		for (var i = 0; i < completedShapes.length; i++) {
			drawShapeOutline(completedShapes[i]);
		}

		// 3. Draw remote in-progress paths
		for (var ri = 0; ri < remotePaths.length; ri++) {
			var rp = remotePaths[ri];
			if (rp.path.length > 1) {
				ctx.strokeStyle = rp.color || '#000000';
				ctx.lineWidth = LINE_WIDTH;
				ctx.lineCap = 'round';
				ctx.lineJoin = 'round';
				ctx.globalAlpha = 0.6;
				ctx.beginPath();
				var rStart = dots[rp.path[0]];
				ctx.moveTo(rStart.x, rStart.y);
				for (var rj = 1; rj < rp.path.length; rj++) {
					var rd = dots[rp.path[rj]];
					ctx.lineTo(rd.x, rd.y);
				}
				ctx.stroke();
				ctx.globalAlpha = 1.0;
			}
		}

		// 4. Draw current path lines
		if (currentPath.length > 0) {
			ctx.strokeStyle = '#000000';
			ctx.lineWidth = LINE_WIDTH;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			ctx.beginPath();
			var startDot = dots[currentPath[0]];
			ctx.moveTo(startDot.x, startDot.y);
			for (var i = 1; i < currentPath.length; i++) {
				var d = dots[currentPath[i]];
				ctx.lineTo(d.x, d.y);
			}
			ctx.stroke();

			// Rubber band line from last dot to cursor or hovered dot
			var lastDot = dots[currentPath[currentPath.length - 1]];
			var targetX, targetY;
			if (hoveredDot !== -1 && hoveredDot !== currentPath[currentPath.length - 1]) {
				targetX = dots[hoveredDot].x;
				targetY = dots[hoveredDot].y;
			} else if (cursorX >= 0 && cursorY >= 0) {
				targetX = cursorX;
				targetY = cursorY;
			} else {
				targetX = null;
			}

			if (targetX !== null) {
				ctx.strokeStyle = '#000000';
				ctx.lineWidth = LINE_WIDTH;
				ctx.globalAlpha = 0.4;
				ctx.beginPath();
				ctx.moveTo(lastDot.x, lastDot.y);
				ctx.lineTo(targetX, targetY);
				ctx.stroke();
				ctx.globalAlpha = 1.0;
			}

			// Highlight the start dot for closure hint
			if (currentPath.length >= 3 && hoveredDot === currentPath[0]) {
				var sd = dots[currentPath[0]];
				ctx.beginPath();
				ctx.arc(sd.x, sd.y, DOT_HOVER_RADIUS + 4, 0, Math.PI * 2);
				ctx.strokeStyle = currentColor;
				ctx.lineWidth = 2;
				ctx.globalAlpha = 0.5;
				ctx.stroke();
				ctx.globalAlpha = 1.0;
			}
		}

		// 5. Draw dots
		for (var i = 0; i < dots.length; i++) {
			drawDot(i);
		}
	}

	function drawBackground(w, h) {
		// Warm solid background matching CircuitBuilder
		ctx.fillStyle = BG_COLOR;
		ctx.fillRect(0, 0, w, h);

		// Subtle dot grid pattern (dark dots on warm bg)
		var spacing = 40;
		ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
		for (var gx = spacing; gx < w; gx += spacing) {
			for (var gy = spacing; gy < h; gy += spacing) {
				ctx.beginPath();
				ctx.arc(gx, gy, 1.5, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}

	function drawFilledShape(shape) {
		if (shape.dotIndices.length < 3) return;
		ctx.beginPath();
		ctx.moveTo(dots[shape.dotIndices[0]].x, dots[shape.dotIndices[0]].y);
		for (var i = 1; i < shape.dotIndices.length; i++) {
			ctx.lineTo(dots[shape.dotIndices[i]].x, dots[shape.dotIndices[i]].y);
		}
		ctx.closePath();
		ctx.fillStyle = hexToRgba(shape.color, 0.35);
		ctx.fill();
	}

	function drawShapeOutline(shape) {
		if (shape.dotIndices.length < 2) return;
		ctx.beginPath();
		ctx.moveTo(dots[shape.dotIndices[0]].x, dots[shape.dotIndices[0]].y);
		for (var i = 1; i < shape.dotIndices.length; i++) {
			ctx.lineTo(dots[shape.dotIndices[i]].x, dots[shape.dotIndices[i]].y);
		}
		ctx.closePath();
		ctx.strokeStyle = shape.color;
		ctx.lineWidth = LINE_WIDTH;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.stroke();
	}

	function drawDot(i) {
		var d = dots[i];
		var scale = dotScales[i];
		var radius = DOT_RADIUS + (DOT_HOVER_RADIUS - DOT_RADIUS) * scale;

		// Check if this dot is part of the current path
		var inPath = false;
		for (var p = 0; p < currentPath.length; p++) {
			if (currentPath[p] === i) { inPath = true; break; }
		}

		// Glow effect for hovered or in-path dots
		if (scale > 0.01) {
			var glow = ctx.createRadialGradient(d.x, d.y, radius * 0.5, d.x, d.y, radius * 2.5);
			glow.addColorStop(0, hexToRgba(currentColor, 0.35 * scale));
			glow.addColorStop(1, hexToRgba(currentColor, 0));
			ctx.beginPath();
			ctx.arc(d.x, d.y, radius * 2.5, 0, Math.PI * 2);
			ctx.fillStyle = glow;
			ctx.fill();
		}

		// Dot shadow
		ctx.beginPath();
		ctx.arc(d.x, d.y + 1.5, radius + 1, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(0,0,0,0.15)';
		ctx.fill();

		// Dot body
		ctx.beginPath();
		ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
		if (inPath) {
			ctx.fillStyle = currentColor;
		} else if (scale > 0.01) {
			ctx.fillStyle = lerpColor(DOT_COLOR, DOT_HOVER_COLOR, scale);
		} else {
			ctx.fillStyle = DOT_COLOR;
		}
		ctx.fill();

		// Dot border for visibility on warm bg
		ctx.strokeStyle = 'rgba(0,0,0,0.12)';
		ctx.lineWidth = 1;
		ctx.stroke();

		// Dot highlight (small white arc at top-left for 3D effect)
		if (radius > 5) {
			ctx.beginPath();
			ctx.arc(d.x - radius * 0.25, d.y - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
			ctx.fillStyle = 'rgba(255,255,255,0.35)';
			ctx.fill();
		}
	}

	// --- Color utilities ---

	function hexToRgba(hex, alpha) {
		var r = parseInt(hex.slice(1, 3), 16);
		var g = parseInt(hex.slice(3, 5), 16);
		var b = parseInt(hex.slice(5, 7), 16);
		return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
	}

	function lerpColor(hex1, hex2, t) {
		var r1 = parseInt(hex1.slice(1, 3), 16);
		var g1 = parseInt(hex1.slice(3, 5), 16);
		var b1 = parseInt(hex1.slice(5, 7), 16);
		var r2 = parseInt(hex2.slice(1, 3), 16);
		var g2 = parseInt(hex2.slice(3, 5), 16);
		var b2 = parseInt(hex2.slice(5, 7), 16);
		var r = Math.round(r1 + (r2 - r1) * t);
		var g = Math.round(g1 + (g2 - g1) * t);
		var b = Math.round(b1 + (b2 - b1) * t);
		return 'rgb(' + r + ',' + g + ',' + b + ')';
	}

	function darkenColor(hex, factor) {
		var r = parseInt(hex.slice(1, 3), 16);
		var g = parseInt(hex.slice(3, 5), 16);
		var b = parseInt(hex.slice(5, 7), 16);
		r = Math.round(r * factor);
		g = Math.round(g * factor);
		b = Math.round(b * factor);
		return 'rgb(' + r + ',' + g + ',' + b + ')';
	}

	// --- Actions (called by activity.js or collaboration) ---

	function setColor(color) {
		currentColor = color;
	}

	function getColor() {
		return currentColor;
	}

	function clear() {
		completedShapes = [];
		currentPath = [];
		undoStack = [];
	}

	function undo() {
		if (currentPath.length > 0) {
			// If there's an active path, cancel it
			currentPath = [];
			return true;
		}
		if (undoStack.length === 0) return false;
		var last = undoStack.pop();
		if (last.type === 'shape') {
			// Remove the last completed shape
			for (var i = completedShapes.length - 1; i >= 0; i--) {
				if (completedShapes[i] === last.data) {
					completedShapes.splice(i, 1);
					break;
				}
			}
		}
		return true;
	}

	// Apply remote action (from collaboration)
	function applyRemoteAction(action) {
		switch (action.type) {
			case 'closeShape':
				var shape = { dotIndices: action.dotIndices, color: action.color };
				completedShapes.push(shape);
				// Remove the user's in-progress path
				if (action.userId) {
					for (var i = remotePaths.length - 1; i >= 0; i--) {
						if (remotePaths[i].userId === action.userId) {
							remotePaths.splice(i, 1);
							break;
						}
					}
				}
				break;
			case 'startPath':
				// Remote user started a new path
				if (action.userId) {
					// Remove any existing path for this user
					for (var i = remotePaths.length - 1; i >= 0; i--) {
						if (remotePaths[i].userId === action.userId) {
							remotePaths.splice(i, 1);
							break;
						}
					}
					remotePaths.push({ userId: action.userId, path: [action.dot], color: action.color });
				}
				break;
			case 'addLine':
				// Remote user added a dot to their path
				if (action.userId) {
					for (var i = 0; i < remotePaths.length; i++) {
						if (remotePaths[i].userId === action.userId) {
							remotePaths[i].path.push(action.to);
							break;
						}
					}
				}
				break;
			case 'clear':
				completedShapes = [];
				currentPath = [];
				undoStack = [];
				remotePaths = [];
				break;
			case 'undo':
				// Remote undo: remove last shape
				if (completedShapes.length > 0) {
					completedShapes.pop();
				}
				break;
		}
	}

	// State for save/load and sharing
	function getState() {
		return {
			completedShapes: completedShapes,
			currentColor: currentColor
		};
	}

	function setState(state) {
		if (state.completedShapes) {
			completedShapes = state.completedShapes;
		}
		if (state.currentColor) {
			currentColor = state.currentColor;
		}
		currentPath = [];
		undoStack = [];
	}

	function setOnAction(callback) {
		onAction = callback;
	}

	function setFullscreen(fs) {
		isFullscreen = fs;
		setTimeout(function () { resize(); }, 50);
	}

	function destroy() {
		if (animationId) {
			cancelAnimationFrame(animationId);
			animationId = null;
		}
	}

	return {
		COLORS: COLORS,
		init: init,
		resize: resize,
		setColor: setColor,
		getColor: getColor,
		clear: clear,
		undo: undo,
		applyRemoteAction: applyRemoteAction,
		getState: getState,
		setState: setState,
		setOnAction: setOnAction,
		setFullscreen: setFullscreen,
		destroy: destroy
	};
});
