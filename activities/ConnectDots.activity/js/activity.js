// ConnectDots Activity - Main entry point
define(["sugar-web/activity/activity", "sugar-web/env", "sugar-web/graphics/presencepalette", "activity/connectdots", "activity/numbermode", "activity/gamemode"], function (activity, env, presencepalette, connectDots, numberMode, gameMode) {

	requirejs(['domReady!', 'humane', 'l10n'], function (doc, humane, l10n) {

		// Setup Sugar activity
		activity.setup();

		// Localization
		var currentenv;
		env.getEnvironment(function (err, environment) {
			currentenv = environment;
			var defaultLanguage = (typeof chrome != 'undefined' && chrome.app && chrome.app.runtime) ? chrome.i18n.getUILanguage() : navigator.language;
			var language = environment.user ? environment.user.language : defaultLanguage;
			l10n.init(language);
		});

		// ═══════════════════════════════════════════
		// State
		// ═══════════════════════════════════════════
		var presence = null;
		var isShared = false;
		var isHost = true;
		var palette = null;
		var currentMode = 'free'; // 'free', 'number', or 'game'
		var opponentCount = 0;
		var opponentFinished = 0;

		// ═══════════════════════════════════════════
		// Initialize all canvases
		// ═══════════════════════════════════════════
		var freeCanvas = document.getElementById('dots-canvas');
		var numberCanvas = document.getElementById('number-canvas');
		var gameCanvas = document.getElementById('game-canvas');
		connectDots.init(freeCanvas);
		numberMode.init(numberCanvas);
		gameMode.init(gameCanvas);

		// Hide non-active canvases initially
		numberCanvas.style.display = 'none';
		gameCanvas.style.display = 'none';

		// ═══════════════════════════════════════════
		// Mode Switching
		// ═══════════════════════════════════════════
		var freeModeBtn = document.getElementById('free-mode-button');
		var numberModeBtn = document.getElementById('number-mode-button');
		var gameModeBtn = document.getElementById('game-mode-button');
		var colorPalette = document.getElementById('color-palette');
		var numberToolButtons = document.querySelectorAll('.number-mode-tool');
		var gameToolButtons = document.querySelectorAll('.game-mode-tool');

		function switchMode(mode) {
			if (mode === currentMode) return;
			currentMode = mode;

			// Reset all mode buttons
			freeModeBtn.classList.remove('active');
			numberModeBtn.classList.remove('active');
			gameModeBtn.classList.remove('active');

			// Hide all canvases
			freeCanvas.style.display = 'none';
			numberCanvas.style.display = 'none';
			gameCanvas.style.display = 'none';

			// Hide all mode-specific tools
			colorPalette.style.display = 'none';
			for (var i = 0; i < numberToolButtons.length; i++) {
				numberToolButtons[i].style.display = 'none';
			}
			for (var i = 0; i < gameToolButtons.length; i++) {
				gameToolButtons[i].style.display = 'none';
			}

			// Hide template selector
			hideTemplateSelector();

			if (mode === 'free') {
				freeModeBtn.classList.add('active');
				freeCanvas.style.display = 'block';
				colorPalette.style.display = '';
			} else if (mode === 'number') {
				numberModeBtn.classList.add('active');
				numberCanvas.style.display = 'block';
				for (var i = 0; i < numberToolButtons.length; i++) {
					numberToolButtons[i].style.display = '';
				}
				numberMode.resize();
				if (!numberMode.getCurrentTemplate()) {
					showTemplateSelector();
				}
			} else if (mode === 'game') {
				gameModeBtn.classList.add('active');
				gameCanvas.style.display = 'block';
				for (var i = 0; i < gameToolButtons.length; i++) {
					gameToolButtons[i].style.display = '';
				}
				gameMode.resize();
			}

			// Broadcast mode switch in shared mode
			if (isShared) {
				sendMessage({ action: 'modeSwitch', mode: mode });
			}
		}

		freeModeBtn.addEventListener('click', function () { switchMode('free'); });
		numberModeBtn.addEventListener('click', function () { switchMode('number'); });
		gameModeBtn.addEventListener('click', function () { switchMode('game'); });

		// ═══════════════════════════════════════════
		// Color palette (Free Draw mode)
		// ═══════════════════════════════════════════
		var colorButtons = document.querySelectorAll('.color-button');
		for (var i = 0; i < colorButtons.length; i++) {
			(function (btn) {
				btn.addEventListener('click', function () {
					for (var j = 0; j < colorButtons.length; j++) {
						colorButtons[j].classList.remove('active');
					}
					btn.classList.add('active');
					connectDots.setColor(btn.getAttribute('data-color'));
				});
			})(colorButtons[i]);
		}

		// ═══════════════════════════════════════════
		// Template Selector
		// ═══════════════════════════════════════════
		var templateSelector = document.getElementById('template-selector');
		var templateGrid = document.getElementById('template-grid');

		document.getElementById('templates-button').addEventListener('click', function () {
			if (templateSelector.style.display === 'none') {
				showTemplateSelector();
			} else {
				hideTemplateSelector();
			}
		});

		document.getElementById('template-selector-close').addEventListener('click', function () {
			hideTemplateSelector();
		});

		function showTemplateSelector() {
			populateTemplateGrid();
			templateSelector.style.display = '';
		}

		function hideTemplateSelector() {
			templateSelector.style.display = 'none';
		}

		function populateTemplateGrid() {
			templateGrid.innerHTML = '';
			var templates = numberMode.getTemplates();

			for (var i = 0; i < templates.length; i++) {
				(function (tmpl) {
					var card = document.createElement('div');
					card.className = 'template-card' + (tmpl.custom ? ' custom' : '');
					card.style.position = 'relative';

					// Preview canvas
					var preview = document.createElement('canvas');
					preview.width = 160;
					preview.height = 160;
					numberMode.drawTemplatePreview(preview, tmpl);
					card.appendChild(preview);

					// Template name with emoji
					var name = document.createElement('div');
					name.className = 'template-card-name';
					name.textContent = tmpl.emoji + ' ' + tmpl.name;
					card.appendChild(name);

					// Dot count
					var dots = document.createElement('div');
					dots.className = 'template-card-dots';
					dots.textContent = tmpl.dots.length + ' dots';
					card.appendChild(dots);

					// Delete button for custom templates
					if (tmpl.custom) {
						var delBtn = document.createElement('button');
						delBtn.className = 'template-card-delete';
						delBtn.textContent = '\u00D7';
						delBtn.addEventListener('click', function (e) {
							e.stopPropagation();
							numberMode.removeCustomTemplate(tmpl.id);
							populateTemplateGrid();
						});
						card.appendChild(delBtn);
					}

					card.addEventListener('click', function () {
						numberMode.loadTemplate(tmpl);
						hideTemplateSelector();

						// In shared mode, broadcast template selection
						if (isShared) {
							sendMessage({
								action: 'numberLoadTemplate',
								templateId: tmpl.id,
								templateData: tmpl
							});
						}
					});

					templateGrid.appendChild(card);
				})(templates[i]);
			}
		}

		// ═══════════════════════════════════════════
		// Template Creation
		// ═══════════════════════════════════════════
		var createTemplateBtn = document.getElementById('create-template-button');
		var saveDialog = document.getElementById('create-save-dialog');
		var nameInput = document.getElementById('template-name-input');
		var saveBtn = document.getElementById('create-save-btn');
		var cancelBtn = document.getElementById('create-cancel-btn');

		createTemplateBtn.addEventListener('click', function () {
			if (numberMode.isInCreationMode()) {
				// Already in creation mode - show save dialog
				if (numberMode.getCreationDotCount() >= 3) {
					saveDialog.style.display = '';
					nameInput.value = '';
					nameInput.focus();
				} else {
					humane.log(l10n.get('NeedMoreDots') || 'Place at least 3 dots!');
				}
			} else {
				// Enter creation mode
				numberMode.startCreation();
				humane.log(l10n.get('CreationMode') || 'Tap to place numbered dots. Click + again to save.');
			}
		});

		saveBtn.addEventListener('click', function () {
			var name = nameInput.value.trim() || 'My Template';
			var template = numberMode.finishCreation(name);
			if (template) {
				saveDialog.style.display = 'none';
				numberMode.loadTemplate(template);
				humane.log(l10n.get('TemplateSaved') || 'Template saved!');
			}
		});

		cancelBtn.addEventListener('click', function () {
			saveDialog.style.display = 'none';
			numberMode.cancelCreation();
		});

		// ═══════════════════════════════════════════
		// Reset button (Number mode)
		// ═══════════════════════════════════════════
		var resetBtn = document.getElementById('reset-button');
		if (resetBtn) {
			resetBtn.addEventListener('click', function () {
				numberMode.reset();
				if (isShared) {
					sendMessage({ action: 'numberReset' });
				}
			});
		}

		// ═══════════════════════════════════════════
		// Game Mode: Start & Difficulty
		// ═══════════════════════════════════════════
		document.getElementById('game-start-button').addEventListener('click', function () {
			gameMode.startGame();
			if (isShared) {
				sendMessage({ action: 'gameStart', difficulty: gameMode.getDifficulty() });
			}
		});

		var diffButtons = document.querySelectorAll('.difficulty-btn');
		for (var i = 0; i < diffButtons.length; i++) {
			(function (btn) {
				btn.addEventListener('click', function () {
					for (var j = 0; j < diffButtons.length; j++) {
						diffButtons[j].classList.remove('active');
					}
					btn.classList.add('active');
					var diff = btn.id.replace('diff-', '');
					gameMode.setDifficulty(diff);
				});
			})(diffButtons[i]);
		}

		// ═══════════════════════════════════════════
		// Undo button (works for both modes)
		// ═══════════════════════════════════════════
		document.getElementById('undo-button').addEventListener('click', function () {
			if (currentMode === 'free') {
				var didUndo = connectDots.undo();
				if (didUndo && isShared) {
					sendMessage({ action: 'undo' });
				}
			} else if (currentMode === 'number') {
				numberMode.undo();
			}
			// No undo in game mode
		});

		// ═══════════════════════════════════════════
		// Clear button (works for both modes)
		// ═══════════════════════════════════════════
		document.getElementById('clear-button').addEventListener('click', function () {
			if (currentMode === 'free') {
				connectDots.clear();
				if (isShared) {
					sendMessage({ action: 'clear' });
				}
			} else if (currentMode === 'number') {
				numberMode.reset();
				if (isShared) {
					sendMessage({ action: 'numberReset' });
				}
			} else if (currentMode === 'game') {
				gameMode.clear();
				if (isShared) {
					sendMessage({ action: 'gameRestart' });
				}
			}
		});

		// ═══════════════════════════════════════════
		// Fullscreen
		// ═══════════════════════════════════════════
		document.getElementById('fullscreen-button').addEventListener('click', function () {
			document.body.classList.add('fullscreen');
			if (currentMode === 'free') {
				connectDots.setFullscreen(true);
			} else if (currentMode === 'number') {
				numberMode.setFullscreen(true);
			} else if (currentMode === 'game') {
				gameMode.setFullscreen(true);
			}
		});

		document.getElementById('unfullscreen-button').addEventListener('click', function () {
			document.body.classList.remove('fullscreen');
			if (currentMode === 'free') {
				connectDots.setFullscreen(false);
			} else if (currentMode === 'number') {
				numberMode.setFullscreen(false);
			} else if (currentMode === 'game') {
				gameMode.setFullscreen(false);
			}
		});

		// ═══════════════════════════════════════════
		// Action callbacks from engines (for sharing)
		// ═══════════════════════════════════════════
		connectDots.setOnAction(function (action) {
			if (!isShared) return;
			sendMessage({ action: action.type, data: action });
		});

		numberMode.setOnAction(function (action) {
			if (!isShared) return;
			if (action.type === 'complete') {
				sendMessage({
					action: 'numberComplete',
					time: action.time,
					user: presence ? presence.getUserInfo() : null
				});
			} else if (action.type === 'connectDot') {
				sendMessage({
					action: 'numberConnectDot',
					dotIndex: action.dotIndex
				});
			}
		});

		numberMode.setOnComplete(function (completionTime) {
			var timeStr = numberMode.formatTime(completionTime);
			humane.log(l10n.get('Completed') || 'Completed in ' + timeStr + '!');
		});

		gameMode.setOnAction(function (action) {
			if (!isShared) return;
			sendMessage({ action: 'game_' + action.type, data: action });
		});

		// ═══════════════════════════════════════════
		// Stop button: save state
		// ═══════════════════════════════════════════
		document.getElementById('stop-button').addEventListener('click', function (event) {
			var state = {
				mode: currentMode,
				freeState: connectDots.getState(),
				numberState: numberMode.getState(),
				gameState: gameMode.getState()
			};
			var jsonData = JSON.stringify(state);
			activity.getDatastoreObject().setDataAsText(jsonData);
			activity.getDatastoreObject().save(function (error) {
				if (error) console.log('Save error:', error);
			});
		});

		// ═══════════════════════════════════════════
		// Presence / Sharing
		// ═══════════════════════════════════════════
		var networkButton = document.getElementById('network-button');
		palette = new presencepalette.PresencePalette(networkButton, undefined);
		palette.addEventListener('shared', function () {
			shareActivity();
		});

		// If launched with a shared id
		if (window.top && window.top.sugar && window.top.sugar.environment && window.top.sugar.environment.sharedId) {
			isHost = false;
			shareActivity();
			palette.setShared(true);
		}

		function shareActivity() {
			presence = activity.getPresenceObject(function (error, presenceObj) {
				if (palette) palette.popDown();
				if (error) {
					console.log('Presence error:', error);
					return;
				}

				presence = presenceObj;
				isShared = true;

				if (!window.top.sugar.environment.sharedId) {
					presence.createSharedActivity('org.sugarlabs.ConnectDotsActivity', function (groupId) {
						console.log('Created shared activity:', groupId);
					});
				}

				// Connection closed
				presence.onConnectionClosed(function (event) {
					console.log('Connection closed');
					isShared = false;
				});

				// User joined/left
				presence.onSharedActivityUserChanged(function (msg) {
					var userName = msg.user.name.replace('<', '&lt;').replace('>', '&gt;');
					if (msg.move === 1) {
						opponentCount++;
						humane.log(l10n.get('PlayerJoin', { user: userName }));
					} else if (msg.move === -1) {
						opponentCount--;
						humane.log(l10n.get('PlayerLeave', { user: userName }));
					}
				});

				// Data received
				presence.onDataReceived(function (msg) {
					if (presence.getUserInfo().networkId === msg.user.networkId) return;

					var me = 'entranceRequest ' + presence.getUserInfo().networkId;

					switch (msg.content.action) {
						// --- Free Draw actions ---
						case 'closeShape':
							connectDots.applyRemoteAction({
								type: 'closeShape',
								dotIndices: msg.content.data.dotIndices,
								color: msg.content.data.color,
								userId: msg.user.networkId
							});
							break;

						case 'startPath':
							connectDots.applyRemoteAction({
								type: 'startPath',
								dot: msg.content.data.dot,
								color: msg.content.data.color,
								userId: msg.user.networkId
							});
							break;

						case 'addLine':
							connectDots.applyRemoteAction({
								type: 'addLine',
								from: msg.content.data.from,
								to: msg.content.data.to,
								color: msg.content.data.color,
								userId: msg.user.networkId
							});
							break;

						case 'clear':
							connectDots.applyRemoteAction({ type: 'clear' });
							break;

						case 'undo':
							connectDots.applyRemoteAction({ type: 'undo' });
							break;

						// --- Mode switching ---
						case 'modeSwitch':
							switchMode(msg.content.mode);
							break;

						// --- Number Mode actions ---
						case 'numberLoadTemplate':
							switchMode('number');
							numberMode.applyRemoteAction({
								type: 'loadTemplate',
								templateId: msg.content.templateId,
								templateData: msg.content.templateData
							});
							opponentFinished = 0;
							break;

						case 'numberConnectDot':
							// Just a progress notification - each player plays independently
							break;

						case 'numberComplete':
							opponentFinished++;
							var completedUser = msg.content.user ? msg.content.user.name : 'Someone';
							var completedTime = numberMode.formatTime(msg.content.time || 0);
							humane.log(l10n.get('PlayerFinished', { user: completedUser.replace('<', '&lt;').replace('>', '&gt;'), time: completedTime }) || completedUser + ' finished in ' + completedTime + '!');
							break;

						case 'numberReset':
							numberMode.reset();
							break;

						// --- Game Mode actions ---
						case 'gameStart':
							switchMode('game');
							gameMode.applyRemoteAction({
								type: 'start',
								difficulty: msg.content.difficulty
							});
							break;

						case 'gameRestart':
							gameMode.applyRemoteAction({ type: 'restart' });
							break;

						case 'game_gameMove':
							gameMode.applyRemoteAction({
								type: 'move',
								playerId: msg.content.data.playerId,
								dir: msg.content.data.dir
							});
							break;

						case 'game_gameCapture':
							gameMode.applyRemoteAction({
								type: 'capture',
								playerId: msg.content.data.playerId,
								score: msg.content.data.score
							});
							break;

						case 'game_gameKill':
							gameMode.applyRemoteAction({
								type: 'kill',
								killerId: msg.content.data.killerId,
								victimId: msg.content.data.victimId
							});
							break;

						case 'game_gameOver':
							// Remote notification of game over
							break;

						// --- Entrance sync ---
						case 'entranceData':
							// Restore full state
							if (msg.content.data.mode) {
								switchMode(msg.content.data.mode);
							}
							if (msg.content.data.freeState) {
								connectDots.setState(msg.content.data.freeState);
							}
							if (msg.content.data.numberState) {
								numberMode.setState(msg.content.data.numberState);
							}
							if (msg.content.data.gameState) {
								gameMode.setState(msg.content.data.gameState);
							}
							break;

						case me:
							// Someone is requesting our full state
							sendMessage({
								action: 'entranceData',
								data: {
									mode: currentMode,
									freeState: connectDots.getState(),
									numberState: numberMode.getState(),
									gameState: gameMode.getState()
								}
							});
							break;
					}
				});

				// If joining (not host), request state
				if (!isHost) {
					var lookInterval = setInterval(function () {
						if (!presence.sharedInfo || !presence.sharedInfo.users) return;
						sendMessage({
							action: 'entranceRequest ' + presence.sharedInfo.users[0]
						});
						clearInterval(lookInterval);
					}, 500);
				}
			});
		}

		function sendMessage(content) {
			if (!presence) return;
			var sharedId = window.top.sugar.environment.sharedId;
			if (!sharedId) {
				sharedId = presence.getSharedInfo().id;
			}
			presence.sendMessage(sharedId, {
				user: presence.getUserInfo(),
				content: content
			});
		}

		// ═══════════════════════════════════════════
		// Load saved data
		// ═══════════════════════════════════════════
		if (!window.top.sugar || !window.top.sugar.environment || !window.top.sugar.environment.sharedId) {
			activity.getDatastoreObject().loadAsText(function (error, metadata, jsonData) {
				if (jsonData == null) return;
				try {
					var state = JSON.parse(jsonData);

					// New format with mode
					if (state.mode) {
						if (state.freeState) {
							connectDots.setState(state.freeState);
						}
						if (state.numberState) {
							numberMode.setState(state.numberState);
						}
						if (state.gameState) {
							gameMode.setState(state.gameState);
						}
						switchMode(state.mode);

						// Sync color button
						if (state.freeState && state.freeState.currentColor) {
							for (var i = 0; i < colorButtons.length; i++) {
								colorButtons[i].classList.remove('active');
								if (colorButtons[i].getAttribute('data-color') === state.freeState.currentColor) {
									colorButtons[i].classList.add('active');
								}
							}
						}
					} else {
						// Legacy format (just free draw state)
						connectDots.setState(state);
						if (state.currentColor) {
							for (var i = 0; i < colorButtons.length; i++) {
								colorButtons[i].classList.remove('active');
								if (colorButtons[i].getAttribute('data-color') === state.currentColor) {
									colorButtons[i].classList.add('active');
								}
							}
						}
					}
				} catch (e) {
					console.log('Error loading saved data:', e);
				}
			});
		}
	});
});
