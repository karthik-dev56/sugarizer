// NumberMode - Connect numbered dots in sequence to reveal shapes
// Kids connect dots 1→2→3→...→N to draw pictures

define([], function () {

	// ═══════════════════════════════════════════
	// 8 Built-in Templates
	// Coordinates are percentages (0-100) of available canvas area
	// ═══════════════════════════════════════════

	var BUILTIN_TEMPLATES = [
		{
			id: 'star',
			name: 'Star',
			emoji: '\u2B50',
			closed: true,
			dots: [
				{x: 50, y: 5},   // 1: top point
				{x: 62, y: 38},  // 2: inner upper-right
				{x: 95, y: 38},  // 3: right point
				{x: 70, y: 58},  // 4: inner lower-right
				{x: 80, y: 92},  // 5: bottom-right point
				{x: 50, y: 72},  // 6: inner bottom
				{x: 20, y: 92},  // 7: bottom-left point
				{x: 30, y: 58},  // 8: inner lower-left
				{x: 5, y: 38},   // 9: left point
				{x: 38, y: 38}   // 10: inner upper-left
			]
		},
		{
			id: 'house',
			name: 'House',
			emoji: '\uD83C\uDFE0',
			closed: true,
			dots: [
				{x: 50, y: 8},   // 1: roof peak
				{x: 85, y: 35},  // 2: roof right
				{x: 85, y: 90},  // 3: wall bottom-right
				{x: 62, y: 90},  // 4: door bottom-right
				{x: 62, y: 65},  // 5: door top-right
				{x: 38, y: 65},  // 6: door top-left
				{x: 38, y: 90},  // 7: door bottom-left
				{x: 15, y: 90},  // 8: wall bottom-left
				{x: 15, y: 35}   // 9: roof left
			]
		},
		{
			id: 'fish',
			name: 'Fish',
			emoji: '\uD83D\uDC1F',
			closed: true,
			dots: [
				{x: 88, y: 50},  // 1: nose
				{x: 72, y: 30},  // 2: upper head
				{x: 55, y: 25},  // 3: upper body
				{x: 35, y: 28},  // 4: upper back
				{x: 15, y: 10},  // 5: tail top
				{x: 22, y: 50},  // 6: tail center
				{x: 15, y: 90},  // 7: tail bottom
				{x: 35, y: 72},  // 8: lower back
				{x: 55, y: 75},  // 9: lower body
				{x: 72, y: 70}   // 10: lower head
			]
		},
		{
			id: 'heart',
			name: 'Heart',
			emoji: '\u2764\uFE0F',
			closed: true,
			dots: [
				{x: 50, y: 85},  // 1: bottom point
				{x: 25, y: 60},  // 2: lower-left curve
				{x: 10, y: 38},  // 3: left side
				{x: 10, y: 20},  // 4: upper-left
				{x: 25, y: 10},  // 5: left bump top
				{x: 42, y: 15},  // 6: left inner
				{x: 50, y: 28},  // 7: center dip
				{x: 58, y: 15},  // 8: right inner
				{x: 75, y: 10},  // 9: right bump top
				{x: 90, y: 20},  // 10: upper-right
				{x: 90, y: 38},  // 11: right side
				{x: 75, y: 60}   // 12: lower-right curve
			]
		},
		{
			id: 'sailboat',
			name: 'Sailboat',
			emoji: '\u26F5',
			closed: true,
			dots: [
				{x: 45, y: 8},   // 1: sail top
				{x: 72, y: 50},  // 2: sail right
				{x: 90, y: 55},  // 3: hull right
				{x: 80, y: 82},  // 4: hull bottom-right
				{x: 20, y: 82},  // 5: hull bottom-left
				{x: 10, y: 55},  // 6: hull left
				{x: 42, y: 50},  // 7: sail left base
				{x: 22, y: 22}   // 8: sail far-left
			]
		},
		{
			id: 'rocket',
			name: 'Rocket',
			emoji: '\uD83D\uDE80',
			closed: true,
			dots: [
				{x: 50, y: 5},   // 1: nose tip
				{x: 62, y: 25},  // 2: right shoulder
				{x: 62, y: 52},  // 3: right body
				{x: 78, y: 72},  // 4: right fin tip
				{x: 62, y: 65},  // 5: right fin base
				{x: 58, y: 90},  // 6: flame right
				{x: 50, y: 78},  // 7: flame center
				{x: 42, y: 90},  // 8: flame left
				{x: 38, y: 65},  // 9: left fin base
				{x: 22, y: 72},  // 10: left fin tip
				{x: 38, y: 52},  // 11: left body
				{x: 38, y: 25}   // 12: left shoulder
			]
		},
		{
			id: 'crown',
			name: 'Crown',
			emoji: '\uD83D\uDC51',
			closed: true,
			dots: [
				{x: 8, y: 82},   // 1: base left
				{x: 8, y: 45},   // 2: left wall
				{x: 25, y: 15},  // 3: left peak
				{x: 35, y: 45},  // 4: left valley
				{x: 50, y: 10},  // 5: center peak
				{x: 65, y: 45},  // 6: right valley
				{x: 75, y: 15},  // 7: right peak
				{x: 92, y: 45},  // 8: right wall
				{x: 92, y: 82}   // 9: base right
			]
		},
		{
			id: 'tree',
			name: 'Tree',
			emoji: '\uD83C\uDF84',
			closed: true,
			dots: [
				{x: 50, y: 5},   // 1: top
				{x: 68, y: 32},  // 2: right upper tier
				{x: 58, y: 35},  // 3: right notch
				{x: 80, y: 65},  // 4: right lower tier
				{x: 58, y: 65},  // 5: trunk right top
				{x: 58, y: 92},  // 6: trunk right bottom
				{x: 42, y: 92},  // 7: trunk left bottom
				{x: 42, y: 65},  // 8: trunk left top
				{x: 20, y: 65},  // 9: left lower tier
				{x: 42, y: 35},  // 10: left notch
				{x: 32, y: 32}   // 11: left upper tier
			]
		}
	];

	// ═══════════════════════════════════════════
	// Configuration
	// ═══════════════════════════════════════════

	var DOT_RADIUS = 18;
	var DOT_ACTIVE_RADIUS = 22;
	var DOT_NEXT_RADIUS = 24;
	var SNAP_RADIUS = 40;
	var LINE_WIDTH = 5;
	var FONT_SIZE = 15;

	var COLORS = {
		background: '#b8956a',
		gridDot: 'rgba(0, 0, 0, 0.08)',
		dotDefault: '#5D4037',
		dotDefaultLight: '#8D6E63',
		dotDefaultStroke: '#FFFFFF',
		dotConnected: '#4CAF50',
		dotConnectedGlow: 'rgba(76, 175, 80, 0.35)',
		dotNext: '#FF9800',
		dotNextGlow: 'rgba(255, 152, 0, 0.4)',
		dotNextPulse: 'rgba(255, 152, 0, 0.25)',
		lineColor: '#333333',
		lineGlow: 'rgba(0, 0, 0, 0.12)',
		numberColor: '#FFFFFF',
		numberShadow: 'rgba(0, 0, 0, 0.4)',
		completeFill: 'rgba(76, 175, 80, 0.12)',
		gridLine: 'rgba(0, 0, 0, 0.03)',
		emptyText: 'rgba(80, 55, 30, 0.5)'
	};

	// ═══════════════════════════════════════════
	// State
	// ═══════════════════════════════════════════

	var canvas, ctx;
	var currentTemplate = null;
	var customTemplates = [];
	var dots = [];           // computed pixel positions: [{x, y, num}]
	var connectedUpTo = 0;   // how many dots connected (0 = none, N = all done)
	var isComplete = false;
	var startTime = 0;
	var completionTime = 0;
	var animationId = null;
	var hoveredDot = -1;
	var cursorX = -1, cursorY = -1;
	var pulsePhase = 0;
	var isFullscreen = false;
	var completeCelebrationPhase = 0;
	var particles = [];

	// Creation mode
	var isCreating = false;
	var creationDots = [];

	// Callbacks
	var onAction = null;
	var onComplete = null;

	// ═══════════════════════════════════════════
	// Initialization
	// ═══════════════════════════════════════════

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
		if (currentTemplate) {
			computeDotPositions(w, h);
		}
	}

	function computeDotPositions(w, h) {
		if (!currentTemplate) return;
		dots = [];

		var templateDots = isCreating ? creationDots : currentTemplate.dots;
		var padX = 80;
		var padY = 60;
		var areaW = w - 2 * padX;
		var areaH = h - 2 * padY;

		// Maintain aspect ratio: find bounding box of template dots
		var minX = 100, maxX = 0, minY = 100, maxY = 0;
		for (var i = 0; i < templateDots.length; i++) {
			if (templateDots[i].x < minX) minX = templateDots[i].x;
			if (templateDots[i].x > maxX) maxX = templateDots[i].x;
			if (templateDots[i].y < minY) minY = templateDots[i].y;
			if (templateDots[i].y > maxY) maxY = templateDots[i].y;
		}

		var rangeX = maxX - minX || 1;
		var rangeY = maxY - minY || 1;
		var scaleX = areaW / rangeX;
		var scaleY = areaH / rangeY;
		var scale = Math.min(scaleX, scaleY);
		var offsetX = padX + (areaW - rangeX * scale) / 2;
		var offsetY = padY + (areaH - rangeY * scale) / 2;

		for (var i = 0; i < templateDots.length; i++) {
			dots.push({
				x: offsetX + (templateDots[i].x - minX) * scale,
				y: offsetY + (templateDots[i].y - minY) * scale,
				num: i + 1
			});
		}
	}

	// ═══════════════════════════════════════════
	// Events
	// ═══════════════════════════════════════════

	function setupEvents() {
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
		if (isComplete) return;

		if (isCreating) {
			handleCreationTap(x, y);
			return;
		}

		if (!currentTemplate || dots.length === 0) return;

		// Find which dot was tapped
		var dotIdx = findNearestDot(x, y);
		if (dotIdx === -1) return;

		var nextDot = connectedUpTo;

		// If tapping the next dot in sequence
		if (dotIdx === nextDot) {
			connectedUpTo++;

			if (onAction) {
				onAction({ type: 'connectDot', dotIndex: dotIdx });
			}

			// Check completion
			if (connectedUpTo >= dots.length) {
				isComplete = true;
				completionTime = Date.now() - startTime;
				completeCelebrationPhase = 0;
				spawnCelebrationParticles();
				if (onAction) {
					onAction({ type: 'complete', time: completionTime });
				}
				if (onComplete) {
					onComplete(completionTime);
				}
			}
		}
	}

	function handleCreationTap(x, y) {
		// In creation mode, place a new dot
		var container = canvas.parentElement;
		var w = container.clientWidth;
		var h = container.clientHeight;
		var padX = 80;
		var padY = 60;

		// Convert pixel position to percentage
		var pctX = ((x - padX) / (w - 2 * padX)) * 100;
		var pctY = ((y - padY) / (h - 2 * padY)) * 100;

		// Clamp to bounds
		pctX = Math.max(0, Math.min(100, pctX));
		pctY = Math.max(0, Math.min(100, pctY));

		creationDots.push({ x: Math.round(pctX), y: Math.round(pctY) });
		computeDotPositions(w, h);

		if (onAction) {
			onAction({ type: 'placeDot', x: pctX, y: pctY, count: creationDots.length });
		}
	}

	// ═══════════════════════════════════════════
	// Celebration particles
	// ═══════════════════════════════════════════

	function spawnCelebrationParticles() {
		particles = [];
		var container = canvas.parentElement;
		var w = container.clientWidth;
		var h = container.clientHeight;
		var starColors = ['#FFD700', '#FF6B6B', '#4FC3F7', '#66BB6A', '#FF8A65', '#BA68C8', '#FFB74D'];
		for (var i = 0; i < 60; i++) {
			particles.push({
				x: w / 2 + (Math.random() - 0.5) * 200,
				y: h / 2 + (Math.random() - 0.5) * 100,
				vx: (Math.random() - 0.5) * 8,
				vy: -Math.random() * 6 - 2,
				size: Math.random() * 6 + 3,
				color: starColors[Math.floor(Math.random() * starColors.length)],
				alpha: 1,
				rotation: Math.random() * 360,
				rotSpeed: (Math.random() - 0.5) * 10,
				shape: Math.random() > 0.5 ? 'star' : 'circle'
			});
		}
	}

	// ═══════════════════════════════════════════
	// Render Loop
	// ═══════════════════════════════════════════

	function startRenderLoop() {
		function loop() {
			update();
			render();
			animationId = requestAnimationFrame(loop);
		}
		animationId = requestAnimationFrame(loop);
	}

	function update() {
		pulsePhase += 0.05;
		if (pulsePhase > Math.PI * 2) pulsePhase -= Math.PI * 2;

		if (isComplete) {
			completeCelebrationPhase += 0.02;
			// Update particles
			for (var i = particles.length - 1; i >= 0; i--) {
				var p = particles[i];
				p.x += p.vx;
				p.y += p.vy;
				p.vy += 0.15; // gravity
				p.alpha -= 0.008;
				p.rotation += p.rotSpeed;
				if (p.alpha <= 0) {
					particles.splice(i, 1);
				}
			}
		}
	}

	function render() {
		if (!canvas) return;
		var w = canvas.width / (window.devicePixelRatio || 1);
		var h = canvas.height / (window.devicePixelRatio || 1);

		// Clear and draw background
		ctx.clearRect(0, 0, w, h);
		drawBackground(w, h);

		if (!currentTemplate && !isCreating) {
			drawEmptyState(w, h);
			return;
		}

		if (dots.length === 0) return;

		// Draw completed shape fill
		if (isComplete && currentTemplate && currentTemplate.closed) {
			drawCompletedFill();
		}

		// Draw connected lines
		drawConnectedLines();

		// Draw rubber band line from last connected to cursor
		if (!isComplete && connectedUpTo > 0 && connectedUpTo < dots.length) {
			drawRubberBand();
		}

		// Draw dots
		for (var i = 0; i < dots.length; i++) {
			drawNumberedDot(i);
		}

		// Draw celebration
		if (isComplete) {
			drawCelebration(w, h);
		}
	}

	function drawBackground(w, h) {
		// Warm solid background matching CircuitBuilder
		ctx.fillStyle = COLORS.background;
		ctx.fillRect(0, 0, w, h);

		// Subtle dot grid pattern (dark dots on warm bg)
		var spacing = 40;
		ctx.fillStyle = COLORS.gridDot;
		for (var gx = spacing; gx < w; gx += spacing) {
			for (var gy = spacing; gy < h; gy += spacing) {
				ctx.beginPath();
				ctx.arc(gx, gy, 1.5, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}

	function drawEmptyState(w, h) {
		ctx.fillStyle = COLORS.emptyText;
		ctx.font = '600 20px "Helvetica", "Arial", sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('Select a template to start connecting dots!', w / 2, h / 2);
	}

	function drawConnectedLines() {
		if (connectedUpTo < 2 && !(isComplete && currentTemplate && currentTemplate.closed)) return;

		var endIdx = isComplete ? dots.length : connectedUpTo;

		// Glow layer
		ctx.strokeStyle = COLORS.lineGlow;
		ctx.lineWidth = LINE_WIDTH + 6;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(dots[0].x, dots[0].y);
		for (var i = 1; i < endIdx; i++) {
			ctx.lineTo(dots[i].x, dots[i].y);
		}
		if (isComplete && currentTemplate && currentTemplate.closed) {
			ctx.lineTo(dots[0].x, dots[0].y);
		}
		ctx.stroke();

		// Main line
		ctx.strokeStyle = COLORS.lineColor;
		ctx.lineWidth = LINE_WIDTH;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(dots[0].x, dots[0].y);
		for (var i = 1; i < endIdx; i++) {
			ctx.lineTo(dots[i].x, dots[i].y);
		}
		if (isComplete && currentTemplate && currentTemplate.closed) {
			ctx.lineTo(dots[0].x, dots[0].y);
		}
		ctx.stroke();
	}

	function drawRubberBand() {
		var lastDot = dots[connectedUpTo - 1];
		var nextDot = dots[connectedUpTo];
		var targetX, targetY;

		if (hoveredDot === connectedUpTo) {
			targetX = nextDot.x;
			targetY = nextDot.y;
		} else if (cursorX >= 0 && cursorY >= 0) {
			targetX = cursorX;
			targetY = cursorY;
		} else {
			return;
		}

		ctx.strokeStyle = COLORS.lineColor;
		ctx.lineWidth = LINE_WIDTH;
		ctx.globalAlpha = 0.3;
		ctx.setLineDash([8, 8]);
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(lastDot.x, lastDot.y);
		ctx.lineTo(targetX, targetY);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.globalAlpha = 1.0;
	}

	function drawCompletedFill() {
		if (dots.length < 3) return;
		ctx.beginPath();
		ctx.moveTo(dots[0].x, dots[0].y);
		for (var i = 1; i < dots.length; i++) {
			ctx.lineTo(dots[i].x, dots[i].y);
		}
		ctx.closePath();
		ctx.fillStyle = COLORS.completeFill;
		ctx.fill();
	}

	function drawNumberedDot(index) {
		var d = dots[index];
		var isConnected = index < connectedUpTo;
		var isNext = index === connectedUpTo && !isComplete;
		var isHovered = index === hoveredDot;
		var radius = DOT_RADIUS;

		if (isNext) {
			// Pulsing "next" dot
			var pulse = Math.sin(pulsePhase) * 0.3 + 0.7;
			radius = DOT_NEXT_RADIUS;

			// Outer pulse ring
			ctx.beginPath();
			ctx.arc(d.x, d.y, radius + 12 * pulse, 0, Math.PI * 2);
			ctx.fillStyle = COLORS.dotNextPulse;
			ctx.globalAlpha = 0.3 * (1 - pulse * 0.5);
			ctx.fill();
			ctx.globalAlpha = 1.0;

			// Glow
			var glow = ctx.createRadialGradient(d.x, d.y, radius * 0.5, d.x, d.y, radius * 2.5);
			glow.addColorStop(0, COLORS.dotNextGlow);
			glow.addColorStop(1, 'rgba(255, 152, 0, 0)');
			ctx.beginPath();
			ctx.arc(d.x, d.y, radius * 2.5, 0, Math.PI * 2);
			ctx.fillStyle = glow;
			ctx.fill();

			// Dot body
			ctx.beginPath();
			ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
			var dotGrad = ctx.createRadialGradient(d.x - radius * 0.3, d.y - radius * 0.3, 0, d.x, d.y, radius);
			dotGrad.addColorStop(0, '#FFE082');
			dotGrad.addColorStop(1, '#FFC107');
			ctx.fillStyle = dotGrad;
			ctx.fill();
			ctx.strokeStyle = '#FFD700';
			ctx.lineWidth = 2.5;
			ctx.stroke();

		} else if (isConnected) {
			radius = DOT_ACTIVE_RADIUS;

			// Green glow
			var glow = ctx.createRadialGradient(d.x, d.y, radius * 0.3, d.x, d.y, radius * 2);
			glow.addColorStop(0, COLORS.dotConnectedGlow);
			glow.addColorStop(1, 'rgba(76, 175, 80, 0)');
			ctx.beginPath();
			ctx.arc(d.x, d.y, radius * 2, 0, Math.PI * 2);
			ctx.fillStyle = glow;
			ctx.fill();

			// Dot body
			ctx.beginPath();
			ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
			var dotGrad = ctx.createRadialGradient(d.x - radius * 0.3, d.y - radius * 0.3, 0, d.x, d.y, radius);
			dotGrad.addColorStop(0, '#81C784');
			dotGrad.addColorStop(1, '#388E3C');
			ctx.fillStyle = dotGrad;
			ctx.fill();
			ctx.strokeStyle = '#4CAF50';
			ctx.lineWidth = 2;
			ctx.stroke();

			// Checkmark
			ctx.strokeStyle = '#FFFFFF';
			ctx.lineWidth = 2.5;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(d.x - 6, d.y);
			ctx.lineTo(d.x - 2, d.y + 5);
			ctx.lineTo(d.x + 7, d.y - 5);
			ctx.stroke();

		} else {
			// Default unconnected dot - high contrast for visibility
			radius = DOT_RADIUS;

			if (isHovered && !isComplete) {
				radius = DOT_RADIUS + 3;
			}

			// Shadow
			ctx.beginPath();
			ctx.arc(d.x, d.y + 2, radius + 1, 0, Math.PI * 2);
			ctx.fillStyle = 'rgba(0,0,0,0.25)';
			ctx.fill();

			// White border ring (for contrast against warm bg)
			ctx.beginPath();
			ctx.arc(d.x, d.y, radius + 2, 0, Math.PI * 2);
			ctx.fillStyle = '#FFFFFF';
			ctx.fill();

			// Dot body - dark brown for contrast
			ctx.beginPath();
			ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
			var dotGrad = ctx.createRadialGradient(d.x - radius * 0.3, d.y - radius * 0.3, 0, d.x, d.y, radius);
			dotGrad.addColorStop(0, COLORS.dotDefaultLight);
			dotGrad.addColorStop(1, COLORS.dotDefault);
			ctx.fillStyle = dotGrad;
			ctx.fill();
			ctx.strokeStyle = 'rgba(255,255,255,0.6)';
			ctx.lineWidth = 2;
			ctx.stroke();

			// Highlight
			ctx.beginPath();
			ctx.arc(d.x - radius * 0.2, d.y - radius * 0.2, radius * 0.35, 0, Math.PI * 2);
			ctx.fillStyle = 'rgba(255,255,255,0.35)';
			ctx.fill();
		}

		// Number label
		ctx.fillStyle = COLORS.numberColor;
		ctx.font = 'bold ' + FONT_SIZE + 'px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		// Shadow for number
		ctx.shadowColor = COLORS.numberShadow;
		ctx.shadowBlur = 3;
		ctx.shadowOffsetX = 1;
		ctx.shadowOffsetY = 1;
		ctx.fillText(d.num.toString(), d.x, d.y + 1);
		ctx.shadowColor = 'transparent';
		ctx.shadowBlur = 0;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;
	}

	function drawCelebration(w, h) {
		// Draw particles
		for (var i = 0; i < particles.length; i++) {
			var p = particles[i];
			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(p.rotation * Math.PI / 180);
			ctx.globalAlpha = p.alpha;

			if (p.shape === 'star') {
				drawMiniStar(0, 0, p.size, p.color);
			} else {
				ctx.beginPath();
				ctx.arc(0, 0, p.size, 0, Math.PI * 2);
				ctx.fillStyle = p.color;
				ctx.fill();
			}
			ctx.restore();
		}
		ctx.globalAlpha = 1.0;

		// "Complete!" text with bounce
		if (completeCelebrationPhase < 3) {
			var textScale = Math.min(1, completeCelebrationPhase * 2);
			var bounce = 1 + Math.sin(completeCelebrationPhase * 5) * 0.1 * Math.max(0, 1 - completeCelebrationPhase * 0.5);

			ctx.save();
			ctx.translate(w / 2, h / 2);
			ctx.scale(textScale * bounce, textScale * bounce);

			// Text with shadow for warm bg
			ctx.shadowColor = 'rgba(0,0,0,0.4)';
			ctx.shadowBlur = 10;
			ctx.shadowOffsetX = 2;
			ctx.shadowOffsetY = 2;
			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 48px "Helvetica", "Arial", sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('\u2B50 Complete! \u2B50', 0, 0);

			// Time display
			if (completionTime > 0) {
				ctx.fillStyle = '#333333';
				ctx.font = '600 22px "Helvetica", "Arial", sans-serif';
				var timeStr = formatTime(completionTime);
				ctx.fillText('Time: ' + timeStr, 0, 40);
			}

			ctx.shadowColor = 'transparent';
			ctx.shadowBlur = 0;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.restore();
		}
	}

	function drawMiniStar(cx, cy, r, color) {
		ctx.beginPath();
		for (var i = 0; i < 5; i++) {
			var angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
			var x = cx + r * Math.cos(angle);
			var y = cy + r * Math.sin(angle);
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.closePath();
		ctx.fillStyle = color;
		ctx.fill();
	}

	function formatTime(ms) {
		var secs = Math.floor(ms / 1000);
		var mins = Math.floor(secs / 60);
		secs = secs % 60;
		if (mins > 0) {
			return mins + 'm ' + secs + 's';
		}
		return secs + '.' + Math.floor((ms % 1000) / 100) + 's';
	}

	// ═══════════════════════════════════════════
	// Template Management
	// ═══════════════════════════════════════════

	function loadTemplate(template) {
		currentTemplate = template;
		connectedUpTo = 0;
		isComplete = false;
		completionTime = 0;
		startTime = Date.now();
		completeCelebrationPhase = 0;
		particles = [];
		isCreating = false;

		var container = canvas.parentElement;
		computeDotPositions(container.clientWidth, container.clientHeight);
	}

	function getTemplates() {
		return BUILTIN_TEMPLATES.concat(customTemplates);
	}

	function getBuiltinTemplates() {
		return BUILTIN_TEMPLATES;
	}

	function addCustomTemplate(name, dots, closed) {
		var template = {
			id: 'custom_' + Date.now(),
			name: name,
			emoji: '\uD83C\uDFA8',
			closed: closed !== false,
			dots: dots,
			custom: true
		};
		customTemplates.push(template);
		return template;
	}

	function removeCustomTemplate(id) {
		for (var i = customTemplates.length - 1; i >= 0; i--) {
			if (customTemplates[i].id === id) {
				customTemplates.splice(i, 1);
				return true;
			}
		}
		return false;
	}

	// ═══════════════════════════════════════════
	// Creation Mode
	// ═══════════════════════════════════════════

	function startCreation() {
		isCreating = true;
		creationDots = [];
		currentTemplate = { id: '_creating', name: 'New Template', emoji: '\uD83C\uDFA8', closed: true, dots: [] };
		connectedUpTo = 0;
		isComplete = false;
		dots = [];
	}

	function undoCreationDot() {
		if (creationDots.length > 0) {
			creationDots.pop();
			var container = canvas.parentElement;
			computeDotPositions(container.clientWidth, container.clientHeight);
		}
	}

	function finishCreation(name) {
		if (creationDots.length < 3) return null;
		var template = addCustomTemplate(name || 'My Template', creationDots.slice(), true);
		isCreating = false;
		creationDots = [];
		return template;
	}

	function cancelCreation() {
		isCreating = false;
		creationDots = [];
		currentTemplate = null;
		dots = [];
	}

	function getCreationDotCount() {
		return creationDots.length;
	}

	function isInCreationMode() {
		return isCreating;
	}

	// ═══════════════════════════════════════════
	// Actions (undo, reset, remote)
	// ═══════════════════════════════════════════

	function undo() {
		if (isCreating) {
			undoCreationDot();
			return true;
		}
		if (connectedUpTo > 0 && !isComplete) {
			connectedUpTo--;
			return true;
		}
		return false;
	}

	function reset() {
		connectedUpTo = 0;
		isComplete = false;
		completionTime = 0;
		startTime = Date.now();
		completeCelebrationPhase = 0;
		particles = [];
	}

	function applyRemoteAction(action) {
		switch (action.type) {
			case 'connectDot':
				if (action.dotIndex === connectedUpTo) {
					connectedUpTo++;
					if (connectedUpTo >= dots.length) {
						isComplete = true;
						completionTime = action.time || 0;
						completeCelebrationPhase = 0;
						spawnCelebrationParticles();
					}
				}
				break;
			case 'loadTemplate':
				var tmpl = null;
				// Find template by id
				var allTemplates = getTemplates();
				for (var i = 0; i < allTemplates.length; i++) {
					if (allTemplates[i].id === action.templateId) {
						tmpl = allTemplates[i];
						break;
					}
				}
				if (!tmpl && action.templateData) {
					tmpl = action.templateData;
				}
				if (tmpl) {
					loadTemplate(tmpl);
				}
				break;
			case 'reset':
				reset();
				break;
			case 'complete':
				// Remote player completed
				break;
		}
	}

	// ═══════════════════════════════════════════
	// State for save/load and sharing
	// ═══════════════════════════════════════════

	function getState() {
		return {
			currentTemplate: currentTemplate,
			customTemplates: customTemplates,
			connectedUpTo: connectedUpTo,
			isComplete: isComplete,
			completionTime: completionTime
		};
	}

	function setState(state) {
		if (state.customTemplates) {
			customTemplates = state.customTemplates;
		}
		if (state.currentTemplate) {
			currentTemplate = state.currentTemplate;
			connectedUpTo = state.connectedUpTo || 0;
			isComplete = state.isComplete || false;
			completionTime = state.completionTime || 0;
			var container = canvas.parentElement;
			computeDotPositions(container.clientWidth, container.clientHeight);
		}
		if (isComplete) {
			startTime = Date.now() - completionTime;
		} else {
			startTime = Date.now();
		}
		particles = [];
		completeCelebrationPhase = 0;
	}

	function setOnAction(callback) {
		onAction = callback;
	}

	function setOnComplete(callback) {
		onComplete = callback;
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

	function getCurrentTemplate() {
		return currentTemplate;
	}

	function isTemplateComplete() {
		return isComplete;
	}

	function getCompletionTime() {
		return completionTime;
	}

	// ═══════════════════════════════════════════
	// Generate template preview (for selector)
	// ═══════════════════════════════════════════

	function drawTemplatePreview(previewCanvas, template) {
		var pCtx = previewCanvas.getContext('2d');
		var pw = previewCanvas.width;
		var ph = previewCanvas.height;
		var pad = 15;

		// Background - warm matching main canvas
		pCtx.fillStyle = '#b8956a';
		pCtx.fillRect(0, 0, pw, ph);

		// Grid dots
		var gridSpacing = 20;
		pCtx.fillStyle = 'rgba(0,0,0,0.06)';
		for (var gx = gridSpacing; gx < pw; gx += gridSpacing) {
			for (var gy = gridSpacing; gy < ph; gy += gridSpacing) {
				pCtx.beginPath();
				pCtx.arc(gx, gy, 0.8, 0, Math.PI * 2);
				pCtx.fill();
			}
		}

		if (!template || !template.dots || template.dots.length === 0) return;

		// Compute positions
		var minX = 100, maxX = 0, minY = 100, maxY = 0;
		for (var i = 0; i < template.dots.length; i++) {
			if (template.dots[i].x < minX) minX = template.dots[i].x;
			if (template.dots[i].x > maxX) maxX = template.dots[i].x;
			if (template.dots[i].y < minY) minY = template.dots[i].y;
			if (template.dots[i].y > maxY) maxY = template.dots[i].y;
		}
		var rangeX = maxX - minX || 1;
		var rangeY = maxY - minY || 1;
		var scaleX = (pw - 2 * pad) / rangeX;
		var scaleY = (ph - 2 * pad) / rangeY;
		var scale = Math.min(scaleX, scaleY);
		var offX = pad + ((pw - 2 * pad) - rangeX * scale) / 2;
		var offY = pad + ((ph - 2 * pad) - rangeY * scale) / 2;

		var pts = [];
		for (var i = 0; i < template.dots.length; i++) {
			pts.push({
				x: offX + (template.dots[i].x - minX) * scale,
				y: offY + (template.dots[i].y - minY) * scale
			});
		}

		// Draw lines (faded, showing the completed shape)
		pCtx.strokeStyle = 'rgba(50, 35, 20, 0.35)';
		pCtx.lineWidth = 2;
		pCtx.lineCap = 'round';
		pCtx.lineJoin = 'round';
		pCtx.beginPath();
		pCtx.moveTo(pts[0].x, pts[0].y);
		for (var i = 1; i < pts.length; i++) {
			pCtx.lineTo(pts[i].x, pts[i].y);
		}
		if (template.closed) {
			pCtx.lineTo(pts[0].x, pts[0].y);
		}
		pCtx.stroke();

		// Draw dots
		for (var i = 0; i < pts.length; i++) {
			// White border for visibility
			pCtx.beginPath();
			pCtx.arc(pts[i].x, pts[i].y, 6.5, 0, Math.PI * 2);
			pCtx.fillStyle = '#FFFFFF';
			pCtx.fill();

			// Dot
			pCtx.beginPath();
			pCtx.arc(pts[i].x, pts[i].y, 5, 0, Math.PI * 2);
			pCtx.fillStyle = '#5D4037';
			pCtx.fill();
			pCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
			pCtx.lineWidth = 1;
			pCtx.stroke();

			// Number
			pCtx.fillStyle = '#FFFFFF';
			pCtx.font = 'bold 8px sans-serif';
			pCtx.textAlign = 'center';
			pCtx.textBaseline = 'middle';
			pCtx.fillText((i + 1).toString(), pts[i].x, pts[i].y);
		}
	}

	// ═══════════════════════════════════════════
	// Public API
	// ═══════════════════════════════════════════

	return {
		init: init,
		resize: resize,
		loadTemplate: loadTemplate,
		getTemplates: getTemplates,
		getBuiltinTemplates: getBuiltinTemplates,
		addCustomTemplate: addCustomTemplate,
		removeCustomTemplate: removeCustomTemplate,
		getCurrentTemplate: getCurrentTemplate,
		isTemplateComplete: isTemplateComplete,
		getCompletionTime: getCompletionTime,
		startCreation: startCreation,
		undoCreationDot: undoCreationDot,
		finishCreation: finishCreation,
		cancelCreation: cancelCreation,
		getCreationDotCount: getCreationDotCount,
		isInCreationMode: isInCreationMode,
		undo: undo,
		reset: reset,
		applyRemoteAction: applyRemoteAction,
		getState: getState,
		setState: setState,
		setOnAction: setOnAction,
		setOnComplete: setOnComplete,
		setFullscreen: setFullscreen,
		destroy: destroy,
		drawTemplatePreview: drawTemplatePreview,
		formatTime: formatTime,
		BUILTIN_TEMPLATES: BUILTIN_TEMPLATES
	};
});
