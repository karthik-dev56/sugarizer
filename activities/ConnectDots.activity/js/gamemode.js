// GameMode - Paper.io inspired territory conquest
// Players move on a grid, leave trails, and capture territory by reconnecting to their base

define([], function () {

	// ═══════════════════════════════════════════
	// Constants
	// ═══════════════════════════════════════════

	var COLS = 40;
	var ROWS = 30;
	var MOVE_INTERVAL = 167; // ms per cell (~6 cells/sec)
	var RESPAWN_TIME = 2000;
	var GAME_DURATION = 90000; // 90 seconds
	var COUNTDOWN_DURATION = 3000;
	var BG_COLOR = '#b8956a';

	var PLAYER_COLORS = [
		{ main: '#FF4444', light: 'rgba(255,68,68,0.55)', trail: 'rgba(255,68,68,0.85)', name: 'Red' },
		{ main: '#2196F3', light: 'rgba(33,150,243,0.55)', trail: 'rgba(33,150,243,0.85)', name: 'Blue' },
		{ main: '#4CAF50', light: 'rgba(76,175,80,0.55)', trail: 'rgba(76,175,80,0.85)', name: 'Green' },
		{ main: '#FF9800', light: 'rgba(255,152,0,0.55)', trail: 'rgba(255,152,0,0.85)', name: 'Orange' }
	];

	var SPAWN_POINTS = [
		{ row: 2, col: 2, dir: 'right' },
		{ row: 27, col: 37, dir: 'left' },
		{ row: 2, col: 37, dir: 'down' },
		{ row: 27, col: 2, dir: 'up' }
	];

	var OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
	var DIR_DELTA = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

	// ═══════════════════════════════════════════
	// State
	// ═══════════════════════════════════════════

	var canvas, ctx;
	var grid; // Uint8Array(COLS * ROWS), 0=unclaimed, 1-4=player id
	var players = [];
	var localPlayerId = 1;
	var gameActive = false;
	var gamePaused = false;
	var gameOver = false;
	var timeLeft = GAME_DURATION;
	var countdownLeft = 0;
	var moveAccum = 0;
	var lastTimestamp = 0;
	var animationId = null;
	var difficulty = 'medium';
	var isFullscreen = false;
	var cellW = 0, cellH = 0;
	var winner = null;
	var particles = [];
	var celebrationPhase = 0;

	// Visual interpolation
	var moveProgress = 0;

	// Touch input
	var touchStartX = -1, touchStartY = -1;
	var touchActive = false;

	// Callbacks
	var onAction = null;

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
		if (!canvas) return;
		var container = canvas.parentElement;
		var dpr = window.devicePixelRatio || 1;
		var w = container.clientWidth;
		var h = container.clientHeight;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		canvas.style.width = w + 'px';
		canvas.style.height = h + 'px';
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		cellW = w / COLS;
		cellH = h / ROWS;
	}

	function setupEvents() {
		var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

		if (isTouchDevice) {
			canvas.addEventListener('touchstart', function (e) {
				e.preventDefault();
				var touch = e.touches[0];
				var pos = getCanvasPos(touch.clientX, touch.clientY);
				touchStartX = pos.x;
				touchStartY = pos.y;
				touchActive = true;
			}, { passive: false });

			canvas.addEventListener('touchmove', function (e) {
				e.preventDefault();
				if (!touchActive || !gameActive || gamePaused || gameOver) return;
				var touch = e.touches[0];
				var pos = getCanvasPos(touch.clientX, touch.clientY);
				var dx = pos.x - touchStartX;
				var dy = pos.y - touchStartY;
				if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
					var dir = getSwipeDir(dx, dy);
					setLocalDirection(dir);
					touchStartX = pos.x;
					touchStartY = pos.y;
				}
			}, { passive: false });

			canvas.addEventListener('touchend', function (e) {
				e.preventDefault();
				if (!touchActive) return;
				touchActive = false;
				// If barely moved, use quadrant tap
				if (!gameActive || gamePaused || gameOver) return;
				var touch = e.changedTouches[0];
				var pos = getCanvasPos(touch.clientX, touch.clientY);
				var dx = pos.x - touchStartX;
				var dy = pos.y - touchStartY;
				if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
					// Quadrant tap relative to player position
					var local = getLocalPlayer();
					if (local) {
						var px = (local.col + 0.5) * cellW;
						var py = (local.row + 0.5) * cellH;
						var tdx = pos.x - px;
						var tdy = pos.y - py;
						var tdir = getSwipeDir(tdx, tdy);
						setLocalDirection(tdir);
					}
				}
			}, { passive: false });
		}

		canvas.addEventListener('mousedown', function (e) {
			if (!gameActive || gamePaused || gameOver) return;
			var pos = getCanvasPos(e.clientX, e.clientY);
			var local = getLocalPlayer();
			if (local) {
				var px = (local.col + 0.5) * cellW;
				var py = (local.row + 0.5) * cellH;
				var dx = pos.x - px;
				var dy = pos.y - py;
				var dir = getSwipeDir(dx, dy);
				setLocalDirection(dir);
			}
		});

		document.addEventListener('keydown', function (e) {
			if (!gameActive || gamePaused || gameOver) return;
			var dir = null;
			switch (e.key) {
				case 'ArrowUp': case 'w': case 'W': dir = 'up'; break;
				case 'ArrowDown': case 's': case 'S': dir = 'down'; break;
				case 'ArrowLeft': case 'a': case 'A': dir = 'left'; break;
				case 'ArrowRight': case 'd': case 'D': dir = 'right'; break;
			}
			if (dir) {
				e.preventDefault();
				setLocalDirection(dir);
			}
		});

		window.addEventListener('resize', function () { resize(); });
	}

	function getCanvasPos(clientX, clientY) {
		var rect = canvas.getBoundingClientRect();
		return { x: clientX - rect.left, y: clientY - rect.top };
	}

	function getSwipeDir(dx, dy) {
		if (Math.abs(dx) > Math.abs(dy)) {
			return dx > 0 ? 'right' : 'left';
		}
		return dy > 0 ? 'down' : 'up';
	}

	function setLocalDirection(dir) {
		var local = getLocalPlayer();
		if (!local || !local.alive) return;
		if (dir === OPPOSITE[local.dir] && local.trail.length > 0) return; // can't reverse on trail
		local.nextDir = dir;
		if (onAction) {
			onAction({ type: 'gameMove', playerId: local.id, dir: dir, row: local.row, col: local.col });
		}
	}

	function getLocalPlayer() {
		for (var i = 0; i < players.length; i++) {
			if (players[i].id === localPlayerId) return players[i];
		}
		return null;
	}

	// ═══════════════════════════════════════════
	// Grid helpers
	// ═══════════════════════════════════════════

	function gridGet(row, col) {
		if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return -1;
		return grid[row * COLS + col];
	}

	function gridSet(row, col, val) {
		if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
			grid[row * COLS + col] = val;
		}
	}

	// ═══════════════════════════════════════════
	// Game lifecycle
	// ═══════════════════════════════════════════

	function startGame() {
		grid = new Uint8Array(COLS * ROWS);
		players = [];
		winner = null;
		gameOver = false;
		particles = [];
		celebrationPhase = 0;
		moveAccum = 0;
		moveProgress = 0;

		// Create local player
		var spawn = SPAWN_POINTS[0];
		players.push(createPlayer(1, spawn.row, spawn.col, spawn.dir, false, false));

		// Create AI opponent
		var aiSpawn = SPAWN_POINTS[1];
		players.push(createPlayer(2, aiSpawn.row, aiSpawn.col, aiSpawn.dir, false, true));

		// Place starting territories
		for (var i = 0; i < players.length; i++) {
			placeStartTerritory(players[i]);
		}

		calculateScores();

		// Start countdown
		countdownLeft = COUNTDOWN_DURATION;
		timeLeft = GAME_DURATION;
		gameActive = true;
		gamePaused = true; // paused during countdown
		lastTimestamp = 0;
	}

	function createPlayer(id, row, col, dir, isLocal, isAI) {
		return {
			id: id,
			color: PLAYER_COLORS[(id - 1) % PLAYER_COLORS.length],
			row: row,
			col: col,
			prevRow: row,
			prevCol: col,
			dir: dir,
			nextDir: dir,
			trail: [],
			trailSet: {},
			alive: true,
			respawnTimer: 0,
			score: 0,
			percentage: 0,
			isAI: isAI,
			aiPlan: [],
			aiPlanStep: 0,
			aiTickSkip: 0,
			spawnRow: row,
			spawnCol: col,
			spawnDir: dir
		};
	}

	function placeStartTerritory(player) {
		for (var dr = -1; dr <= 1; dr++) {
			for (var dc = -1; dc <= 1; dc++) {
				var r = player.row + dr;
				var c = player.col + dc;
				if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
					gridSet(r, c, player.id);
				}
			}
		}
	}

	function resetGame() {
		gameActive = false;
		gameOver = false;
		gamePaused = false;
		winner = null;
		players = [];
		grid = null;
		particles = [];
	}

	// ═══════════════════════════════════════════
	// Game loop
	// ═══════════════════════════════════════════

	function startRenderLoop() {
		function loop(timestamp) {
			if (lastTimestamp === 0) lastTimestamp = timestamp;
			var dt = Math.min(timestamp - lastTimestamp, 100); // cap at 100ms
			lastTimestamp = timestamp;

			if (gameActive) {
				update(dt);
			}
			render();
			animationId = requestAnimationFrame(loop);
		}
		animationId = requestAnimationFrame(loop);
	}

	function update(dt) {
		// Countdown phase
		if (countdownLeft > 0) {
			countdownLeft -= dt;
			if (countdownLeft <= 0) {
				countdownLeft = 0;
				gamePaused = false;
			}
			return;
		}

		if (gamePaused || gameOver) return;

		// Timer
		timeLeft -= dt;
		if (timeLeft <= 0) {
			timeLeft = 0;
			endGame();
			return;
		}

		// Respawn timers
		for (var i = 0; i < players.length; i++) {
			if (!players[i].alive) {
				players[i].respawnTimer -= dt;
				if (players[i].respawnTimer <= 0) {
					respawnPlayer(players[i]);
				}
			}
		}

		// Movement accumulator
		moveAccum += dt;
		if (moveAccum >= MOVE_INTERVAL) {
			moveAccum -= MOVE_INTERVAL;
			if (moveAccum > MOVE_INTERVAL) moveAccum = 0; // prevent spiral

			// Store previous positions for interpolation
			for (var i = 0; i < players.length; i++) {
				players[i].prevRow = players[i].row;
				players[i].prevCol = players[i].col;
			}

			// AI decisions
			for (var i = 0; i < players.length; i++) {
				if (players[i].isAI && players[i].alive) {
					aiTick(players[i]);
				}
			}

			// Move all players
			for (var i = 0; i < players.length; i++) {
				if (players[i].alive) {
					stepPlayer(players[i]);
				}
			}

			moveProgress = 0;
		}

		moveProgress = Math.min(1, moveAccum / MOVE_INTERVAL);

		// Celebration particles
		if (gameOver) {
			updateParticles();
		}
	}

	function stepPlayer(player) {
		// Apply buffered direction
		if (player.nextDir && player.nextDir !== OPPOSITE[player.dir]) {
			player.dir = player.nextDir;
		}
		player.nextDir = null;

		var delta = DIR_DELTA[player.dir];
		var newRow = player.row + delta[0];
		var newCol = player.col + delta[1];

		// Wall bounce - reverse direction if hitting border
		if (newRow < 0 || newRow >= ROWS || newCol < 0 || newCol >= COLS) {
			// Stay in place this tick
			return;
		}

		var cellOwner = gridGet(newRow, newCol);
		var trailKey = newRow + ',' + newCol;

		// Check if stepping on own trail (self-kill)
		if (player.trailSet[trailKey]) {
			killPlayer(player);
			return;
		}

		// Check if stepping on another player's trail (kill them)
		for (var i = 0; i < players.length; i++) {
			var other = players[i];
			if (other.id !== player.id && other.alive && other.trailSet[trailKey]) {
				killPlayer(other);
				if (onAction) {
					onAction({ type: 'gameKill', killerId: player.id, victimId: other.id });
				}
			}
		}

		// Check head-on collision
		for (var i = 0; i < players.length; i++) {
			var other = players[i];
			if (other.id !== player.id && other.alive && other.row === newRow && other.col === newCol) {
				// Both outside territory? Both die
				if (player.trail.length > 0 && other.trail.length > 0) {
					killPlayer(player);
					killPlayer(other);
					return;
				}
			}
		}

		// Move player
		player.row = newRow;
		player.col = newCol;

		// Territory logic
		if (cellOwner === player.id) {
			// Returned to own territory
			if (player.trail.length > 0) {
				captureTerritory(player);
				if (onAction) {
					onAction({ type: 'gameCapture', playerId: player.id, score: player.score });
				}
			}
		} else {
			// Outside own territory - add to trail
			player.trail.push({ row: newRow, col: newCol });
			player.trailSet[trailKey] = true;
		}
	}

	function killPlayer(player) {
		// Clear trail from grid display
		player.trail = [];
		player.trailSet = {};
		player.alive = false;
		player.respawnTimer = RESPAWN_TIME;
	}

	function respawnPlayer(player) {
		player.alive = true;
		player.row = player.spawnRow;
		player.col = player.spawnCol;
		player.prevRow = player.spawnRow;
		player.prevCol = player.spawnCol;
		player.dir = player.spawnDir;
		player.nextDir = player.spawnDir;
		player.trail = [];
		player.trailSet = {};
		// Ensure spawn territory still exists
		placeStartTerritory(player);
	}

	// ═══════════════════════════════════════════
	// Territory Capture (Border Flood Fill)
	// ═══════════════════════════════════════════

	function captureTerritory(player) {
		var pid = player.id;

		// Step 1: Mark all trail cells as player's territory
		for (var i = 0; i < player.trail.length; i++) {
			var t = player.trail[i];
			gridSet(t.row, t.col, pid);
		}

		// Step 2: Flood fill from all border cells NOT owned by this player
		var visited = new Uint8Array(COLS * ROWS);
		var queue = [];

		// Seed borders
		for (var r = 0; r < ROWS; r++) {
			for (var c = 0; c < COLS; c++) {
				if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
					if (gridGet(r, c) !== pid) {
						var idx = r * COLS + c;
						if (!visited[idx]) {
							visited[idx] = 1;
							queue.push(idx);
						}
					}
				}
			}
		}

		// BFS
		var head = 0;
		while (head < queue.length) {
			var idx = queue[head++];
			var cr = (idx / COLS) | 0;
			var cc = idx % COLS;
			var neighbors = [cr - 1, cc, cr + 1, cc, cr, cc - 1, cr, cc + 1];
			for (var n = 0; n < 8; n += 2) {
				var nr = neighbors[n];
				var nc = neighbors[n + 1];
				if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
					var nidx = nr * COLS + nc;
					if (!visited[nidx] && gridGet(nr, nc) !== pid) {
						visited[nidx] = 1;
						queue.push(nidx);
					}
				}
			}
		}

		// Step 3: Claim unreachable cells (not in active trails of other players)
		for (var i = 0; i < COLS * ROWS; i++) {
			if (!visited[i] && grid[i] !== pid) {
				// Check if cell is in another player's active trail
				var r = (i / COLS) | 0;
				var c = i % COLS;
				var inTrail = false;
				for (var j = 0; j < players.length; j++) {
					if (players[j].id !== pid && players[j].alive) {
						var key = r + ',' + c;
						if (players[j].trailSet[key]) {
							inTrail = true;
							break;
						}
					}
				}
				if (!inTrail) {
					grid[i] = pid;
				}
			}
		}

		// Step 4: Clear trail
		player.trail = [];
		player.trailSet = {};

		// Step 5: Recalculate scores
		calculateScores();
	}

	function calculateScores() {
		var counts = {};
		for (var i = 0; i < players.length; i++) {
			counts[players[i].id] = 0;
		}
		var total = COLS * ROWS;
		for (var i = 0; i < total; i++) {
			if (grid[i] > 0 && counts[grid[i]] !== undefined) {
				counts[grid[i]]++;
			}
		}
		for (var i = 0; i < players.length; i++) {
			players[i].score = counts[players[i].id] || 0;
			players[i].percentage = Math.round((players[i].score / total) * 100);
		}
	}

	// ═══════════════════════════════════════════
	// End Game
	// ═══════════════════════════════════════════

	function endGame() {
		gameOver = true;
		gamePaused = true;
		calculateScores();

		// Find winner
		var maxScore = -1;
		winner = null;
		for (var i = 0; i < players.length; i++) {
			if (players[i].score > maxScore) {
				maxScore = players[i].score;
				winner = players[i];
			}
		}

		celebrationPhase = 0;
		spawnCelebrationParticles();

		if (onAction) {
			onAction({ type: 'gameOver', winnerId: winner ? winner.id : 0 });
		}
	}

	// ═══════════════════════════════════════════
	// AI Opponent
	// ═══════════════════════════════════════════

	function aiTick(ai) {
		var skipRate = difficulty === 'easy' ? 2 : 0;
		if (skipRate > 0) {
			ai.aiTickSkip++;
			if (ai.aiTickSkip % (skipRate + 1) !== 0) return;
		}

		// Max trail length based on difficulty
		var maxTrail = difficulty === 'easy' ? 8 : difficulty === 'medium' ? 14 : 20;

		// Trail too long - head home
		if (ai.trail.length >= maxTrail) {
			ai.nextDir = dirTowardOwnTerritory(ai);
			return;
		}

		// Evasion: check if local player is near trail
		if (difficulty !== 'easy' && ai.trail.length > 0) {
			var local = getLocalPlayer();
			if (local && local.alive) {
				var dist = Math.abs(local.row - ai.row) + Math.abs(local.col - ai.col);
				var evadeDist = difficulty === 'hard' ? 8 : 5;
				if (dist < evadeDist) {
					ai.nextDir = dirTowardOwnTerritory(ai);
					return;
				}
			}
		}

		// Follow plan or create new one
		if (ai.aiPlan.length === 0 || ai.aiPlanStep >= ai.aiPlan.length) {
			ai.aiPlan = generateAIPlan(ai);
			ai.aiPlanStep = 0;
		}

		if (ai.aiPlanStep < ai.aiPlan.length) {
			var planned = ai.aiPlan[ai.aiPlanStep];
			// Don't reverse
			if (planned !== OPPOSITE[ai.dir] || ai.trail.length === 0) {
				ai.nextDir = planned;
			}
			ai.aiPlanStep++;
		}
	}

	function generateAIPlan(ai) {
		var plan = [];
		var size = difficulty === 'easy' ? randInt(2, 4) : difficulty === 'medium' ? randInt(3, 6) : randInt(4, 8);

		// Pick a direction to expand toward unclaimed territory
		var expandDirs = ['up', 'down', 'left', 'right'];
		// Shuffle
		for (var i = expandDirs.length - 1; i > 0; i--) {
			var j = randInt(0, i);
			var tmp = expandDirs[i];
			expandDirs[i] = expandDirs[j];
			expandDirs[j] = tmp;
		}

		// Pick the first direction that leads away from walls and toward unclaimed area
		var outDir = null;
		for (var d = 0; d < expandDirs.length; d++) {
			var dd = DIR_DELTA[expandDirs[d]];
			var checkR = ai.row + dd[0] * size;
			var checkC = ai.col + dd[1] * size;
			if (checkR >= 1 && checkR < ROWS - 1 && checkC >= 1 && checkC < COLS - 1) {
				outDir = expandDirs[d];
				break;
			}
		}
		if (!outDir) outDir = expandDirs[0];

		// Build a rectangular loop: out, turn, across, turn, back
		var turnDir = getTurnDirection(outDir);
		var acrossSize = randInt(2, size);

		for (var i = 0; i < size; i++) plan.push(outDir);
		for (var i = 0; i < acrossSize; i++) plan.push(turnDir);
		for (var i = 0; i < size; i++) plan.push(OPPOSITE[outDir]);
		for (var i = 0; i < acrossSize; i++) plan.push(OPPOSITE[turnDir]);

		return plan;
	}

	function getTurnDirection(dir) {
		if (dir === 'up' || dir === 'down') return Math.random() > 0.5 ? 'left' : 'right';
		return Math.random() > 0.5 ? 'up' : 'down';
	}

	function dirTowardOwnTerritory(player) {
		// BFS to find nearest own territory cell
		var visited = {};
		var queue = [{ row: player.row, col: player.col, firstDir: null }];
		visited[player.row + ',' + player.col] = true;

		var dirs = ['up', 'down', 'left', 'right'];
		while (queue.length > 0) {
			var cur = queue.shift();
			for (var d = 0; d < dirs.length; d++) {
				var dd = DIR_DELTA[dirs[d]];
				var nr = cur.row + dd[0];
				var nc = cur.col + dd[1];
				var key = nr + ',' + nc;
				if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[key]) {
					visited[key] = true;
					var firstDir = cur.firstDir || dirs[d];
					if (gridGet(nr, nc) === player.id) {
						// Don't choose reverse
						if (firstDir === OPPOSITE[player.dir] && player.trail.length > 0) continue;
						return firstDir;
					}
					// Don't path through own trail
					if (!player.trailSet[key]) {
						queue.push({ row: nr, col: nc, firstDir: firstDir });
					}
				}
			}
		}
		return player.dir; // fallback: keep going
	}

	function randInt(min, max) {
		return min + Math.floor(Math.random() * (max - min + 1));
	}

	// ═══════════════════════════════════════════
	// Celebration particles
	// ═══════════════════════════════════════════

	function spawnCelebrationParticles() {
		particles = [];
		var w = canvas.width / (window.devicePixelRatio || 1);
		var h = canvas.height / (window.devicePixelRatio || 1);
		var colors = ['#FFD700', '#FF6B6B', '#4FC3F7', '#66BB6A', '#FF8A65', '#BA68C8', '#FFB74D'];
		for (var i = 0; i < 80; i++) {
			particles.push({
				x: w / 2 + (Math.random() - 0.5) * 300,
				y: h / 2 + (Math.random() - 0.5) * 150,
				vx: (Math.random() - 0.5) * 10,
				vy: -Math.random() * 8 - 2,
				size: Math.random() * 6 + 3,
				color: colors[Math.floor(Math.random() * colors.length)],
				alpha: 1,
				rotation: Math.random() * 360,
				rotSpeed: (Math.random() - 0.5) * 10,
				shape: Math.random() > 0.5 ? 'star' : 'circle'
			});
		}
	}

	function updateParticles() {
		celebrationPhase += 0.02;
		for (var i = particles.length - 1; i >= 0; i--) {
			var p = particles[i];
			p.x += p.vx;
			p.y += p.vy;
			p.vy += 0.15;
			p.alpha -= 0.006;
			p.rotation += p.rotSpeed;
			if (p.alpha <= 0) particles.splice(i, 1);
		}
	}

	// ═══════════════════════════════════════════
	// Rendering
	// ═══════════════════════════════════════════

	function render() {
		if (!canvas || !ctx) return;
		var w = canvas.width / (window.devicePixelRatio || 1);
		var h = canvas.height / (window.devicePixelRatio || 1);

		ctx.clearRect(0, 0, w, h);
		drawBackground(w, h);

		if (!gameActive && !gameOver) {
			drawWaitingScreen(w, h);
			return;
		}

		drawTerritory();
		drawTrails();
		drawGridLines(w, h);
		drawPlayers();
		drawScoreBar(w);
		drawTimer(w);

		if (countdownLeft > 0) {
			drawCountdown(w, h);
		}

		if (gameOver) {
			drawVictory(w, h);
		}
	}

	function drawBackground(w, h) {
		ctx.fillStyle = BG_COLOR;
		ctx.fillRect(0, 0, w, h);

		var spacing = 40;
		ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
		for (var gx = spacing; gx < w; gx += spacing) {
			for (var gy = spacing; gy < h; gy += spacing) {
				ctx.beginPath();
				ctx.arc(gx, gy, 2, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}

	function drawGridLines(w, h) {
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.07)';
		ctx.lineWidth = 0.5;
		for (var c = 1; c < COLS; c++) {
			ctx.beginPath();
			ctx.moveTo(c * cellW, 0);
			ctx.lineTo(c * cellW, h);
			ctx.stroke();
		}
		for (var r = 1; r < ROWS; r++) {
			ctx.beginPath();
			ctx.moveTo(0, r * cellH);
			ctx.lineTo(w, r * cellH);
			ctx.stroke();
		}
	}

	function drawTerritory() {
		if (!grid) return;
		// Group cells by owner for batched rendering
		for (var pid = 1; pid <= 4; pid++) {
			var playerObj = null;
			for (var p = 0; p < players.length; p++) {
				if (players[p].id === pid) { playerObj = players[p]; break; }
			}
			if (!playerObj) continue;

			ctx.fillStyle = playerObj.color.light;
			for (var r = 0; r < ROWS; r++) {
				var spanStart = -1;
				for (var c = 0; c <= COLS; c++) {
					var owner = c < COLS ? gridGet(r, c) : -1;
					if (owner === pid) {
						if (spanStart === -1) spanStart = c;
					} else {
						if (spanStart !== -1) {
							ctx.fillRect(spanStart * cellW, r * cellH, (c - spanStart) * cellW, cellH);
							spanStart = -1;
						}
					}
				}
			}
		}
	}

	function drawTrails() {
		for (var i = 0; i < players.length; i++) {
			var p = players[i];
			if (p.trail.length === 0) continue;

			ctx.fillStyle = p.color.trail;
			ctx.strokeStyle = 'rgba(255,255,255,0.4)';
			ctx.lineWidth = 1;
			for (var j = 0; j < p.trail.length; j++) {
				var t = p.trail[j];
				var x = t.col * cellW + 1;
				var y = t.row * cellH + 1;
				var w = cellW - 2;
				var h = cellH - 2;
				ctx.beginPath();
				drawRoundRect(ctx, x, y, w, h, 3);
				ctx.fill();
				ctx.stroke();
			}
		}
	}

	function drawPlayers() {
		for (var i = 0; i < players.length; i++) {
			var p = players[i];
			if (!p.alive) {
				// Blink during respawn
				if (Math.floor(p.respawnTimer / 200) % 2 === 0) {
					drawPlayerSprite(p, 0.4);
				}
				continue;
			}

			drawPlayerSprite(p, 1.0);
		}
	}

	function drawPlayerSprite(player, alpha) {
		// Interpolated position
		var t = moveProgress;
		var drawRow = player.prevRow + (player.row - player.prevRow) * t;
		var drawCol = player.prevCol + (player.col - player.prevCol) * t;

		var cx = (drawCol + 0.5) * cellW;
		var cy = (drawRow + 0.5) * cellH;
		var size = Math.min(cellW, cellH) * 1.15; // larger sprite for visibility
		var half = size / 2;

		ctx.globalAlpha = alpha;

		// Glow ring for visibility
		ctx.beginPath();
		ctx.arc(cx, cy, half + 3, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255,255,255,0.4)';
		ctx.fill();

		// Body - rounded square
		ctx.fillStyle = player.color.main;
		ctx.beginPath();
		drawRoundRect(ctx, cx - half, cy - half, size, size, size * 0.25);
		ctx.fill();

		// Border - white for contrast
		ctx.strokeStyle = '#FFFFFF';
		ctx.lineWidth = 2;
		ctx.beginPath();
		drawRoundRect(ctx, cx - half, cy - half, size, size, size * 0.25);
		ctx.stroke();

		// Highlight
		ctx.fillStyle = 'rgba(255,255,255,0.3)';
		ctx.beginPath();
		drawRoundRect(ctx, cx - half + 2, cy - half + 2, size * 0.5, size * 0.35, size * 0.15);
		ctx.fill();

		// Eyes - shift in direction of movement
		var eyeOffX = 0, eyeOffY = 0;
		var eyeShift = size * 0.08;
		if (player.dir === 'left') eyeOffX = -eyeShift;
		else if (player.dir === 'right') eyeOffX = eyeShift;
		else if (player.dir === 'up') eyeOffY = -eyeShift;
		else if (player.dir === 'down') eyeOffY = eyeShift;

		var eyeR = size * 0.1;
		var eyeSpacing = size * 0.2;
		var eyeY = cy - size * 0.05 + eyeOffY;

		// White part
		ctx.fillStyle = '#FFFFFF';
		ctx.beginPath();
		ctx.arc(cx - eyeSpacing + eyeOffX, eyeY, eyeR * 1.4, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.arc(cx + eyeSpacing + eyeOffX, eyeY, eyeR * 1.4, 0, Math.PI * 2);
		ctx.fill();

		// Pupil
		ctx.fillStyle = '#333333';
		ctx.beginPath();
		ctx.arc(cx - eyeSpacing + eyeOffX * 1.5, eyeY + eyeOffY * 0.5, eyeR * 0.8, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.arc(cx + eyeSpacing + eyeOffX * 1.5, eyeY + eyeOffY * 0.5, eyeR * 0.8, 0, Math.PI * 2);
		ctx.fill();

		// Smile
		var smileY = cy + size * 0.18;
		ctx.strokeStyle = '#FFFFFF';
		ctx.lineWidth = 1.5;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.arc(cx + eyeOffX * 0.5, smileY, size * 0.12, 0.1 * Math.PI, 0.9 * Math.PI);
		ctx.stroke();

		ctx.globalAlpha = 1.0;
	}

	function drawScoreBar(w) {
		if (players.length === 0) return;

		var barH = 36;
		var barY = 6;

		// Background
		ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
		ctx.beginPath();
		drawRoundRect(ctx, 10, barY, w - 20, barH, 10);
		ctx.fill();

		var entryW = (w - 40) / players.length;
		for (var i = 0; i < players.length; i++) {
			var p = players[i];
			var ex = 20 + i * entryW;

			// Color indicator
			ctx.fillStyle = p.color.main;
			ctx.beginPath();
			ctx.arc(ex + 10, barY + barH / 2, 8, 0, Math.PI * 2);
			ctx.fill();
			ctx.strokeStyle = 'rgba(255,255,255,0.5)';
			ctx.lineWidth = 1.5;
			ctx.stroke();

			// Name + percentage
			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 13px "Helvetica", "Arial", sans-serif';
			ctx.textAlign = 'left';
			ctx.textBaseline = 'middle';
			var label = (p.isAI ? 'AI' : (p.id === localPlayerId ? 'You' : 'P' + p.id));
			ctx.fillText(label + ': ' + p.percentage + '%', ex + 24, barY + barH / 2);

			// Mini progress bar
			var barStartX = ex + 90;
			var barWidth = entryW - 105;
			if (barWidth > 20) {
				ctx.fillStyle = 'rgba(255,255,255,0.15)';
				ctx.beginPath();
				drawRoundRect(ctx, barStartX, barY + barH / 2 - 4, barWidth, 8, 4);
				ctx.fill();

				ctx.fillStyle = p.color.main;
				var fillW = Math.max(0, (p.percentage / 100) * barWidth);
				if (fillW > 0) {
					ctx.beginPath();
					drawRoundRect(ctx, barStartX, barY + barH / 2 - 4, fillW, 8, 4);
					ctx.fill();
				}
			}
		}
	}

	function drawTimer(w) {
		var secs = Math.ceil(timeLeft / 1000);
		var mins = Math.floor(secs / 60);
		secs = secs % 60;
		var timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;

		var timerX = w - 15;
		var timerY = 54;

		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';

		if (timeLeft < 10000) {
			// Red pulsing
			var pulse = 0.7 + Math.sin(Date.now() / 200) * 0.3;
			ctx.fillStyle = 'rgba(255, 68, 68, ' + pulse + ')';
			ctx.font = 'bold 20px "Helvetica", "Arial", sans-serif';
		} else {
			ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
			ctx.font = 'bold 16px "Helvetica", "Arial", sans-serif';
		}

		ctx.shadowColor = 'rgba(0,0,0,0.5)';
		ctx.shadowBlur = 4;
		ctx.fillText(timeStr, timerX, timerY);
		ctx.shadowColor = 'transparent';
		ctx.shadowBlur = 0;
	}

	function drawCountdown(w, h) {
		var num = Math.ceil(countdownLeft / 1000);
		var frac = (countdownLeft % 1000) / 1000;
		var text = num > 0 ? num.toString() : 'GO!';

		// Dim overlay
		ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
		ctx.fillRect(0, 0, w, h);

		var scale = 1 + (1 - frac) * 0.5;

		ctx.save();
		ctx.translate(w / 2, h / 2);
		ctx.scale(scale, scale);
		ctx.globalAlpha = frac * 0.9 + 0.1;

		ctx.fillStyle = '#FFFFFF';
		ctx.font = 'bold 80px "Helvetica", "Arial", sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.shadowColor = 'rgba(0,0,0,0.5)';
		ctx.shadowBlur = 10;
		ctx.fillText(text, 0, 0);
		ctx.shadowColor = 'transparent';
		ctx.shadowBlur = 0;

		ctx.restore();
		ctx.globalAlpha = 1.0;
	}

	function drawVictory(w, h) {
		// Particles
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

		// Dim overlay
		ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
		ctx.fillRect(0, 0, w, h);

		if (celebrationPhase < 4) {
			var textScale = Math.min(1, celebrationPhase * 2);
			var bounce = 1 + Math.sin(celebrationPhase * 5) * 0.08 * Math.max(0, 1 - celebrationPhase * 0.3);

			ctx.save();
			ctx.translate(w / 2, h / 2 - 20);
			ctx.scale(textScale * bounce, textScale * bounce);

			ctx.shadowColor = 'rgba(0,0,0,0.5)';
			ctx.shadowBlur = 10;

			// Winner text
			if (winner) {
				ctx.fillStyle = winner.color.main;
				ctx.font = 'bold 50px "Helvetica", "Arial", sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				var winLabel = winner.id === localPlayerId ? 'You Win!' : (winner.isAI ? 'AI Wins!' : 'Player ' + winner.id + ' Wins!');
				ctx.fillText(winLabel, 0, 0);

				ctx.fillStyle = '#FFFFFF';
				ctx.font = '600 24px "Helvetica", "Arial", sans-serif';
				ctx.fillText(winner.percentage + '% territory', 0, 45);
			}

			ctx.shadowColor = 'transparent';
			ctx.shadowBlur = 0;
			ctx.restore();
		}
	}

	function drawWaitingScreen(w, h) {
		ctx.fillStyle = 'rgba(80, 55, 30, 0.5)';
		ctx.font = '600 22px "Helvetica", "Arial", sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('Press Start to begin the territory game!', w / 2, h / 2 - 15);

		ctx.fillStyle = 'rgba(80, 55, 30, 0.35)';
		ctx.font = '400 16px "Helvetica", "Arial", sans-serif';
		ctx.fillText('Use arrow keys or swipe to move. Capture territory!', w / 2, h / 2 + 20);
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

	function drawRoundRect(ctx, x, y, w, h, r) {
		if (r > w / 2) r = w / 2;
		if (r > h / 2) r = h / 2;
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + w - r, y);
		ctx.quadraticCurveTo(x + w, y, x + w, y + r);
		ctx.lineTo(x + w, y + h - r);
		ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
		ctx.lineTo(x + r, y + h);
		ctx.quadraticCurveTo(x, y + h, x, y + h - r);
		ctx.lineTo(x, y + r);
		ctx.quadraticCurveTo(x, y, x + r, y);
		ctx.closePath();
	}

	// ═══════════════════════════════════════════
	// Collaboration
	// ═══════════════════════════════════════════

	function applyRemoteAction(action) {
		switch (action.type) {
			case 'move':
				// Find player and set direction
				for (var i = 0; i < players.length; i++) {
					if (players[i].id === action.playerId) {
						players[i].nextDir = action.dir;
						break;
					}
				}
				break;

			case 'capture':
				// Sync scores
				for (var i = 0; i < players.length; i++) {
					if (players[i].id === action.playerId) {
						players[i].score = action.score;
						break;
					}
				}
				break;

			case 'kill':
				for (var i = 0; i < players.length; i++) {
					if (players[i].id === action.victimId) {
						killPlayer(players[i]);
						break;
					}
				}
				break;

			case 'start':
				if (action.difficulty) difficulty = action.difficulty;
				startGame();
				break;

			case 'restart':
				startGame();
				break;

			case 'state':
				// Full state restore
				if (action.grid) {
					grid = new Uint8Array(action.grid);
				}
				if (action.players) {
					players = [];
					for (var i = 0; i < action.players.length; i++) {
						var pd = action.players[i];
						var p = createPlayer(pd.id, pd.row, pd.col, pd.dir, false, pd.isAI);
						p.score = pd.score || 0;
						p.percentage = pd.percentage || 0;
						p.trail = pd.trail || [];
						p.trailSet = {};
						for (var j = 0; j < p.trail.length; j++) {
							p.trailSet[p.trail[j].row + ',' + p.trail[j].col] = true;
						}
						p.alive = pd.alive !== false;
						players.push(p);
					}
				}
				if (action.timeLeft !== undefined) timeLeft = action.timeLeft;
				if (action.gameActive !== undefined) gameActive = action.gameActive;
				if (action.gameOver !== undefined) gameOver = action.gameOver;
				gamePaused = gameOver;
				countdownLeft = 0;
				break;

			case 'addPlayer':
				// Add a human player for a new joiner
				var spawnIdx = action.playerId - 1;
				if (spawnIdx >= 0 && spawnIdx < SPAWN_POINTS.length) {
					// Remove AI at this slot if exists
					for (var i = players.length - 1; i >= 0; i--) {
						if (players[i].id === action.playerId) {
							players.splice(i, 1);
							break;
						}
					}
					var sp = SPAWN_POINTS[spawnIdx];
					var newP = createPlayer(action.playerId, sp.row, sp.col, sp.dir, false, false);
					players.push(newP);
					if (gameActive) placeStartTerritory(newP);
				}
				break;
		}
	}

	// ═══════════════════════════════════════════
	// State save/load
	// ═══════════════════════════════════════════

	function getState() {
		return {
			grid: grid ? Array.from(grid) : null,
			players: players.map(function (p) {
				return {
					id: p.id,
					row: p.row,
					col: p.col,
					dir: p.dir,
					trail: p.trail,
					alive: p.alive,
					score: p.score,
					percentage: p.percentage,
					isAI: p.isAI,
					spawnRow: p.spawnRow,
					spawnCol: p.spawnCol,
					spawnDir: p.spawnDir
				};
			}),
			timeLeft: timeLeft,
			gameActive: gameActive,
			gameOver: gameOver,
			difficulty: difficulty
		};
	}

	function setState(state) {
		if (!state) return;
		difficulty = state.difficulty || 'medium';
		if (state.grid) {
			grid = new Uint8Array(state.grid);
		}
		if (state.players && state.players.length > 0) {
			players = [];
			for (var i = 0; i < state.players.length; i++) {
				var pd = state.players[i];
				var p = createPlayer(pd.id, pd.row, pd.col, pd.dir, false, pd.isAI);
				p.score = pd.score || 0;
				p.percentage = pd.percentage || 0;
				p.trail = pd.trail || [];
				p.trailSet = {};
				for (var j = 0; j < p.trail.length; j++) {
					p.trailSet[p.trail[j].row + ',' + p.trail[j].col] = true;
				}
				p.alive = pd.alive !== false;
				p.spawnRow = pd.spawnRow;
				p.spawnCol = pd.spawnCol;
				p.spawnDir = pd.spawnDir;
				players.push(p);
			}
		}
		timeLeft = state.timeLeft || GAME_DURATION;
		gameActive = state.gameActive || false;
		gameOver = state.gameOver || false;
		gamePaused = gameOver;
		countdownLeft = 0;
		moveAccum = 0;
		moveProgress = 0;
		lastTimestamp = 0;
		winner = null;
		particles = [];

		if (gameOver) {
			var maxScore = -1;
			for (var i = 0; i < players.length; i++) {
				if (players[i].score > maxScore) {
					maxScore = players[i].score;
					winner = players[i];
				}
			}
		}
	}

	function setOnAction(callback) { onAction = callback; }

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

	function clear() {
		resetGame();
	}

	function setDifficulty(d) {
		difficulty = d;
	}

	function getDifficulty() {
		return difficulty;
	}

	function isGameActive() {
		return gameActive;
	}

	function isGameOver() {
		return gameOver;
	}

	// ═══════════════════════════════════════════
	// Public API
	// ═══════════════════════════════════════════

	return {
		init: init,
		resize: resize,
		startGame: startGame,
		getState: getState,
		setState: setState,
		setOnAction: setOnAction,
		applyRemoteAction: applyRemoteAction,
		setFullscreen: setFullscreen,
		destroy: destroy,
		clear: clear,
		setDifficulty: setDifficulty,
		getDifficulty: getDifficulty,
		isGameActive: isGameActive,
		isGameOver: isGameOver
	};
});
