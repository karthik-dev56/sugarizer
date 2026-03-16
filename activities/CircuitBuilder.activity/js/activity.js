define(["sugar-web/activity/activity", "sugar-web/env"], function (activity, env) {

    requirejs(['domReady!'], function (doc) {

        activity.setup();

        var canvas = document.getElementById('circuit-canvas');
        var ctx = canvas.getContext('2d');

        // ===== STATE =====
        var components = [];
        var wires = [];
        var switchStates = {};
        var nextId = 1;
        var currentTool = 'select';
        var terminals = [];
        var animFrame = null;

        // Interaction state
        var hoverTerminal = null;
        var mousePos = { x: 0, y: 0 };
        var sparkParticles = [];

        // Component dragging
        var isDraggingComponent = false;
        var dragComp = null;
        var dragOffset = { x: 0, y: 0 };
        var dragStartPos = { x: 0, y: 0 };
        var dragMoved = false;

        // Wire drawing
        var isDrawingWire = false;
        var wireFromId = null;
        var wireToPos = null;
        var selectedTerminalId = null;

        console.log('[CircuitBuilder] Sandbox mode loaded');

        // ===== COLORS =====
        var COLORS = {
            background: '#b8956a',
            wire: '#333333',
            wireActive: '#FFD54F',
            terminal: '#444444',
            terminalHover: '#FF9800',
            terminalActive: '#4CAF50',
            batteryBody: '#222222',
            batteryTop: '#E8A000',
            batteryPlus: '#FFFFFF',
            bulbGlass: '#E8F5E9',
            bulbGlassOn: '#FFFF88',
            bulbFilament: '#888888',
            bulbFilamentOn: '#FF8800',
            bulbBase: '#AAAAAA',
            switchBody: '#FFAB91',
            switchBodyOn: '#66BB6A',
            switchKnob: '#FF5722',
            switchKnobOn: '#2E7D32',
            text: '#FFFFFF',
            gridDot: 'rgba(0,0,0,0.08)',
            deleteHighlight: 'rgba(244,67,54,0.25)'
        };

        var COMP = {
            BATTERY: 'battery',
            BULB: 'bulb',
            SWITCH: 'switch'
        };

        // ===== COMPONENT MANAGEMENT =====
        function addComponent(type, fracX, fracY) {
            var id = 'comp_' + nextId++;
            var comp = { id: id, type: type, x: fracX, y: fracY };
            components.push(comp);
            if (type === COMP.SWITCH) {
                switchStates[id] = false;
            }
            recalcTerminals();
            addSparks(fracX * canvas.width, fracY * canvas.height);
            return comp;
        }

        function removeComponent(compId) {
            wires = wires.filter(function (w) {
                return w.from.indexOf(compId + '_') !== 0 && w.to.indexOf(compId + '_') !== 0;
            });
            components = components.filter(function (c) { return c.id !== compId; });
            delete switchStates[compId];
            recalcTerminals();
        }

        function removeWireAt(x, y) {
            var closestIdx = -1;
            var closestDist = 25;
            wires.forEach(function (w, idx) {
                var fromT = findTerminal(w.from);
                var toT = findTerminal(w.to);
                if (fromT && toT) {
                    var d = distToSegment({ x: x, y: y }, fromT, toT);
                    if (d < closestDist) {
                        closestDist = d;
                        closestIdx = idx;
                    }
                }
            });
            if (closestIdx >= 0) {
                wires.splice(closestIdx, 1);
                return true;
            }
            return false;
        }

        function clearAll() {
            components = [];
            wires = [];
            switchStates = {};
            terminals = [];
            sparkParticles = [];
            selectedTerminalId = null;
            isDraggingComponent = false;
            isDrawingWire = false;
            wireFromId = null;
            wireToPos = null;
            dragComp = null;
        }

        // ===== TERMINAL FUNCTIONS =====
        function getTerminalsForComponent(comp, cw, ch) {
            var cx = comp.x * cw;
            var cy = comp.y * ch;
            var size = Math.min(cw, ch) * 0.055;
            var ts = [];

            if (comp.type === COMP.BATTERY) {
                ts.push({ id: comp.id + '_pos', compId: comp.id, type: 'pos', x: cx, y: cy - size * 1.6, compType: comp.type });
                ts.push({ id: comp.id + '_neg', compId: comp.id, type: 'neg', x: cx, y: cy + size * 1.6, compType: comp.type });
            } else if (comp.type === COMP.BULB) {
                ts.push({ id: comp.id + '_a', compId: comp.id, type: 'a', x: cx - size * 1.3, y: cy + size * 0.6, compType: comp.type });
                ts.push({ id: comp.id + '_b', compId: comp.id, type: 'b', x: cx + size * 1.3, y: cy + size * 0.6, compType: comp.type });
            } else if (comp.type === COMP.SWITCH) {
                ts.push({ id: comp.id + '_a', compId: comp.id, type: 'a', x: cx - size * 1.5, y: cy, compType: comp.type });
                ts.push({ id: comp.id + '_b', compId: comp.id, type: 'b', x: cx + size * 1.5, y: cy, compType: comp.type });
            }
            return ts;
        }

        function recalcTerminals() {
            terminals = [];
            components.forEach(function (comp) {
                var ts = getTerminalsForComponent(comp, canvas.width, canvas.height);
                terminals = terminals.concat(ts);
            });
        }

        function findTerminal(id) {
            for (var i = 0; i < terminals.length; i++) {
                if (terminals[i].id === id) return terminals[i];
            }
            return null;
        }

        function findTerminalAt(x, y) {
            var radius = Math.min(canvas.width, canvas.height) * 0.045;
            var best = null;
            var bestDist = radius;
            for (var i = 0; i < terminals.length; i++) {
                var dx = terminals[i].x - x;
                var dy = terminals[i].y - y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = terminals[i];
                }
            }
            return best;
        }

        function findComponentAt(x, y) {
            var size = Math.min(canvas.width, canvas.height) * 0.055;
            for (var i = components.length - 1; i >= 0; i--) {
                var comp = components[i];
                var cx = comp.x * canvas.width;
                var cy = comp.y * canvas.height;
                var dx = cx - x;
                var dy = cy - y;
                if (Math.sqrt(dx * dx + dy * dy) < size * 2) {
                    return comp;
                }
            }
            return null;
        }

        // ===== CIRCUIT GRAPH =====
        function buildGraph() {
            var adj = {};
            terminals.forEach(function (t) { adj[t.id] = []; });

            components.forEach(function (comp) {
                var compTerminals = terminals.filter(function (t) { return t.compId === comp.id; });
                if (compTerminals.length === 2) {
                    var a = compTerminals[0].id;
                    var b = compTerminals[1].id;
                    if (comp.type === COMP.SWITCH) {
                        if (switchStates[comp.id]) {
                            adj[a].push(b);
                            adj[b].push(a);
                        }
                    } else if (comp.type !== COMP.BATTERY) {
                        adj[a].push(b);
                        adj[b].push(a);
                    }
                }
            });

            wires.forEach(function (w) {
                if (adj[w.from] && adj[w.to]) {
                    adj[w.from].push(w.to);
                    adj[w.to].push(w.from);
                }
            });

            return adj;
        }

        function bfsReachable(adj, start) {
            var visited = {};
            var queue = [start];
            visited[start] = true;
            while (queue.length > 0) {
                var node = queue.shift();
                (adj[node] || []).forEach(function (neighbor) {
                    if (!visited[neighbor]) {
                        visited[neighbor] = true;
                        queue.push(neighbor);
                    }
                });
            }
            return visited;
        }

        function getBulbStates(adj) {
            var states = {};
            var batteries = components.filter(function (c) { return c.type === COMP.BATTERY; });

            components.forEach(function (comp) {
                if (comp.type !== COMP.BULB) return;
                var aId = comp.id + '_a';
                var bId = comp.id + '_b';
                states[comp.id] = false;

                for (var b = 0; b < batteries.length; b++) {
                    var bat = batteries[b];
                    var posId = bat.id + '_pos';
                    var negId = bat.id + '_neg';
                    var reachFromPos = bfsReachable(adj, posId);
                    if (reachFromPos[aId] && reachFromPos[bId] && reachFromPos[negId]) {
                        states[comp.id] = true;
                        break;
                    }
                }
            });
            return states;
        }

        // ===== DRAWING FUNCTIONS =====
        function resizeCanvas() {
            var rect = canvas.parentElement.getBoundingClientRect();
            var w = rect.width || window.innerWidth;
            var h = rect.height || (window.innerHeight - 55);
            if (canvas.width !== Math.floor(w) || canvas.height !== Math.floor(h)) {
                canvas.width = Math.floor(w);
                canvas.height = Math.floor(h);
            }
        }

        function drawBackground() {
            ctx.fillStyle = COLORS.background;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            var spacing = 40;
            ctx.fillStyle = COLORS.gridDot;
            for (var x = spacing; x < canvas.width; x += spacing) {
                for (var y = spacing; y < canvas.height; y += spacing) {
                    ctx.beginPath();
                    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        function drawHint() {
            if (components.length > 0) return;
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '22px Helvetica, Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Click a component button to start building!', canvas.width / 2, canvas.height / 2 - 15);
            ctx.font = '16px Helvetica, Arial, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText('Add batteries, bulbs, and switches, then wire them together', canvas.width / 2, canvas.height / 2 + 20);
        }

        function drawBattery(comp, size) {
            var cx = comp.x * canvas.width;
            var cy = comp.y * canvas.height;
            var w = size * 1.4;
            var h = size * 2.2;

            // Battery cap
            ctx.fillStyle = '#888888';
            var capW = w * 0.4;
            var capH = h * 0.12;
            ctx.beginPath();
            drawRoundRect(cx - capW / 2, cy - h / 2 - capH, capW, capH, 2);
            ctx.fill();

            // Battery body top
            ctx.fillStyle = COLORS.batteryTop;
            ctx.beginPath();
            drawRoundRect(cx - w / 2, cy - h / 2, w, h * 0.4, [4, 4, 0, 0]);
            ctx.fill();

            // Battery body bottom
            ctx.fillStyle = COLORS.batteryBody;
            ctx.beginPath();
            drawRoundRect(cx - w / 2, cy - h / 2 + h * 0.4, w, h * 0.6, [0, 0, 4, 4]);
            ctx.fill();

            // Plus sign
            ctx.fillStyle = COLORS.batteryPlus;
            ctx.font = 'bold ' + (size * 0.5) + 'px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+', cx, cy - h * 0.15);

            // Minus sign
            ctx.fillStyle = '#AAAAAA';
            ctx.fillText('\u2212', cx, cy + h * 0.22);
        }

        function drawBulb(comp, size, isOn) {
            var cx = comp.x * canvas.width;
            var cy = comp.y * canvas.height;
            var radius = size * 0.9;

            // Glow
            if (isOn) {
                var grad = ctx.createRadialGradient(cx, cy - size * 0.3, 0, cx, cy - size * 0.3, radius * 2.5);
                grad.addColorStop(0, 'rgba(255,255,150,0.5)');
                grad.addColorStop(0.5, 'rgba(255,255,100,0.15)');
                grad.addColorStop(1, 'rgba(255,255,100,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy - size * 0.3, radius * 2.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Glass
            ctx.fillStyle = isOn ? COLORS.bulbGlassOn : COLORS.bulbGlass;
            ctx.strokeStyle = '#888888';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy - size * 0.3, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Filament
            ctx.strokeStyle = isOn ? COLORS.bulbFilamentOn : COLORS.bulbFilament;
            ctx.lineWidth = isOn ? 2.5 : 1.5;
            ctx.beginPath();
            ctx.moveTo(cx - radius * 0.35, cy + radius * 0.1);
            ctx.lineTo(cx, cy - radius * 0.5);
            ctx.lineTo(cx + radius * 0.35, cy + radius * 0.1);
            ctx.stroke();

            // Base
            var baseW = radius * 1.2;
            var baseH = radius * 0.45;
            ctx.fillStyle = COLORS.bulbBase;
            ctx.strokeStyle = '#777';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            drawRoundRect(cx - baseW / 2, cy + radius * 0.5, baseW, baseH, 3);
            ctx.fill();
            ctx.stroke();

            // Base stripes
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 1;
            for (var i = 1; i <= 2; i++) {
                var sy = cy + radius * 0.5 + (baseH / 3) * i;
                ctx.beginPath();
                ctx.moveTo(cx - baseW / 2 + 2, sy);
                ctx.lineTo(cx + baseW / 2 - 2, sy);
                ctx.stroke();
            }
        }

        function drawSwitch(comp, size) {
            var cx = comp.x * canvas.width;
            var cy = comp.y * canvas.height;
            var isOn = !!switchStates[comp.id];
            var w = size * 2.5;
            var h = size * 0.8;

            // Base
            ctx.fillStyle = isOn ? COLORS.switchBodyOn : COLORS.switchBody;
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.beginPath();
            drawRoundRect(cx - w / 2, cy - h / 2, w, h, 6);
            ctx.fill();
            ctx.stroke();

            // Lever
            ctx.strokeStyle = isOn ? COLORS.switchKnobOn : COLORS.switchKnob;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            if (isOn) {
                ctx.moveTo(cx - w * 0.3, cy);
                ctx.lineTo(cx + w * 0.3, cy);
            } else {
                ctx.moveTo(cx - w * 0.3, cy);
                ctx.lineTo(cx + w * 0.1, cy - h * 0.8);
            }
            ctx.stroke();
            ctx.lineCap = 'butt';

            // Label
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold ' + (size * 0.28) + 'px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(isOn ? 'ON' : 'OFF', cx, cy + h * 0.9);
        }

        function drawTerminal(t, isHover, isActive) {
            var radius = Math.min(canvas.width, canvas.height) * 0.022;

            // Hover glow ring
            if (isHover) {
                ctx.fillStyle = 'rgba(255,152,0,0.3)';
                ctx.beginPath();
                ctx.arc(t.x, t.y, radius * 1.8, 0, Math.PI * 2);
                ctx.fill();
            }

            // Pulsing ring
            var pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.003);
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.2 + pulse * 0.3) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(t.x, t.y, radius * 1.3, 0, Math.PI * 2);
            ctx.stroke();

            // Main circle
            ctx.fillStyle = isActive ? COLORS.terminalActive : (isHover ? COLORS.terminalHover : COLORS.terminal);
            ctx.beginPath();
            ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
            ctx.fill();

            // Border
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Inner dot
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.arc(t.x, t.y, radius * 0.35, 0, Math.PI * 2);
            ctx.fill();
        }

        function drawWire(fromT, toT, isActive) {
            ctx.strokeStyle = isActive ? COLORS.wireActive : COLORS.wire;
            ctx.lineWidth = isActive ? 4 : 3;
            ctx.lineCap = 'round';

            var dx = toT.x - fromT.x;
            var dy = toT.y - fromT.y;
            var mx = (fromT.x + toT.x) / 2;
            var my = (fromT.y + toT.y) / 2;
            var perpX = -dy * 0.15;
            var perpY = dx * 0.15;

            ctx.beginPath();
            ctx.moveTo(fromT.x, fromT.y);
            ctx.quadraticCurveTo(mx + perpX, my + perpY, toT.x, toT.y);
            ctx.stroke();
            ctx.lineCap = 'butt';
        }

        function drawDragWire(from, toPos) {
            ctx.strokeStyle = '#FF9800';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(toPos.x, toPos.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineCap = 'butt';
        }

        function drawGhostComponent(type, px, py, size) {
            if (px <= 0 && py <= 0) return;
            ctx.globalAlpha = 0.35;
            var ghost = { x: px / canvas.width, y: py / canvas.height, id: '_ghost' };
            if (type === COMP.BATTERY) drawBattery(ghost, size);
            else if (type === COMP.BULB) drawBulb(ghost, size, false);
            else if (type === COMP.SWITCH) drawSwitch(ghost, size);
            ctx.globalAlpha = 1.0;
        }

        function drawDeleteHighlight(comp, size) {
            var cx = comp.x * canvas.width;
            var cy = comp.y * canvas.height;
            ctx.fillStyle = COLORS.deleteHighlight;
            ctx.beginPath();
            ctx.arc(cx, cy, size * 2.5, 0, Math.PI * 2);
            ctx.fill();

            // X mark
            ctx.strokeStyle = 'rgba(244,67,54,0.6)';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            var s = size * 0.8;
            ctx.beginPath();
            ctx.moveTo(cx - s, cy - s);
            ctx.lineTo(cx + s, cy + s);
            ctx.moveTo(cx + s, cy - s);
            ctx.lineTo(cx - s, cy + s);
            ctx.stroke();
            ctx.lineCap = 'butt';
        }

        // ===== SPARKS =====
        function addSparks(x, y) {
            for (var i = 0; i < 8; i++) {
                var angle = Math.random() * Math.PI * 2;
                var speed = 1 + Math.random() * 3;
                sparkParticles.push({
                    x: x, y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1.0,
                    color: Math.random() > 0.5 ? '#FFD54F' : '#FF9800'
                });
            }
        }

        function updateAndDrawSparks() {
            var alive = [];
            sparkParticles.forEach(function (p) {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.03;
                if (p.life > 0) {
                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
                    ctx.fill();
                    alive.push(p);
                }
            });
            ctx.globalAlpha = 1.0;
            sparkParticles = alive;
        }

        // ===== UTILITY =====
        function drawRoundRect(x, y, w, h, r) {
            if (typeof r === 'number') r = [r, r, r, r];
            if (!r) r = [0, 0, 0, 0];
            while (r.length < 4) r.push(0);
            ctx.moveTo(x + r[0], y);
            ctx.lineTo(x + w - r[1], y);
            ctx.arcTo(x + w, y, x + w, y + r[1], r[1]);
            ctx.lineTo(x + w, y + h - r[2]);
            ctx.arcTo(x + w, y + h, x + w - r[2], y + h, r[2]);
            ctx.lineTo(x + r[3], y + h);
            ctx.arcTo(x, y + h, x, y + h - r[3], r[3]);
            ctx.lineTo(x, y + r[0]);
            ctx.arcTo(x, y, x + r[0], y, r[0]);
            ctx.closePath();
        }

        function distToSegment(p, a, b) {
            var dx = b.x - a.x;
            var dy = b.y - a.y;
            var lenSq = dx * dx + dy * dy;
            if (lenSq === 0) return Math.sqrt((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y));
            var t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
            var projX = a.x + t * dx;
            var projY = a.y + t * dy;
            return Math.sqrt((p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY));
        }

        function getPointerPos(e) {
            var rect = canvas.getBoundingClientRect();
            var clientX, clientY;
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else if (e.changedTouches && e.changedTouches.length > 0) {
                clientX = e.changedTouches[0].clientX;
                clientY = e.changedTouches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            return {
                x: (clientX - rect.left) * (canvas.width / rect.width),
                y: (clientY - rect.top) * (canvas.height / rect.height)
            };
        }

        function tryConnect(fromId, toTerminal) {
            if (!fromId || !toTerminal) return false;
            if (toTerminal.id === fromId) return false;
            var fromTerminal = findTerminal(fromId);
            if (!fromTerminal) return false;
            if (toTerminal.compId === fromTerminal.compId) return false;

            var exists = wires.some(function (w) {
                return (w.from === fromId && w.to === toTerminal.id) ||
                       (w.from === toTerminal.id && w.to === fromId);
            });
            if (exists) return false;

            wires.push({ from: fromId, to: toTerminal.id });
            addSparks(toTerminal.x, toTerminal.y);
            addSparks(fromTerminal.x, fromTerminal.y);
            return true;
        }

        // ===== TOOL MANAGEMENT =====
        var toolButtons = {
            'battery': document.getElementById('add-battery-button'),
            'bulb': document.getElementById('add-bulb-button'),
            'switch': document.getElementById('add-switch-button'),
            'delete': document.getElementById('delete-button')
        };

        function setTool(tool) {
            if (currentTool === tool && tool !== 'select') {
                currentTool = 'select';
            } else {
                currentTool = tool;
            }
            selectedTerminalId = null;
            updateToolbarHighlight();
            updateCursor();
        }

        function updateToolbarHighlight() {
            Object.keys(toolButtons).forEach(function (key) {
                if (toolButtons[key]) {
                    if (key === currentTool) {
                        toolButtons[key].classList.add('active');
                    } else {
                        toolButtons[key].classList.remove('active');
                    }
                }
            });
        }

        function updateCursor() {
            if (currentTool === 'delete') {
                canvas.style.cursor = 'not-allowed';
            } else if (currentTool !== 'select') {
                canvas.style.cursor = 'copy';
            } else {
                canvas.style.cursor = 'crosshair';
            }
        }

        // ===== TOOLBAR EVENTS =====
        document.getElementById('add-battery-button').addEventListener('click', function () {
            setTool('battery');
        });

        document.getElementById('add-bulb-button').addEventListener('click', function () {
            setTool('bulb');
        });

        document.getElementById('add-switch-button').addEventListener('click', function () {
            setTool('switch');
        });

        document.getElementById('delete-button').addEventListener('click', function () {
            setTool('delete');
        });

        document.getElementById('clear-button').addEventListener('click', function () {
            clearAll();
        });

        // Fullscreen
        document.getElementById('fullscreen-button').addEventListener('click', function () {
            document.getElementById('main-toolbar').style.display = 'none';
            document.getElementById('canvas').style.top = '0px';
            document.getElementById('unfullscreen-button').style.visibility = 'visible';
        });

        document.getElementById('unfullscreen-button').addEventListener('click', function () {
            document.getElementById('main-toolbar').style.display = '';
            document.getElementById('canvas').style.top = '55px';
            document.getElementById('unfullscreen-button').style.visibility = 'hidden';
        });

        // ===== INPUT HANDLING =====
        function handlePointerDown(pos) {
            // DELETE MODE
            if (currentTool === 'delete') {
                var t = findTerminalAt(pos.x, pos.y);
                if (t) {
                    wires = wires.filter(function (w) {
                        return w.from !== t.id && w.to !== t.id;
                    });
                    return;
                }
                var comp = findComponentAt(pos.x, pos.y);
                if (comp) {
                    addSparks(comp.x * canvas.width, comp.y * canvas.height);
                    removeComponent(comp.id);
                    return;
                }
                removeWireAt(pos.x, pos.y);
                return;
            }

            // ADD COMPONENT MODE
            if (currentTool === 'battery' || currentTool === 'bulb' || currentTool === 'switch') {
                var fracX = pos.x / canvas.width;
                var fracY = pos.y / canvas.height;
                fracX = Math.max(0.08, Math.min(0.92, fracX));
                fracY = Math.max(0.08, Math.min(0.92, fracY));
                addComponent(currentTool, fracX, fracY);
                return;
            }

            // SELECT MODE - check terminal first for wire drawing
            var t = findTerminalAt(pos.x, pos.y);
            if (t) {
                if (selectedTerminalId && selectedTerminalId !== t.id) {
                    if (tryConnect(selectedTerminalId, t)) {
                        selectedTerminalId = null;
                        return;
                    }
                }
                isDrawingWire = true;
                wireFromId = t.id;
                wireToPos = pos;
                selectedTerminalId = t.id;
                return;
            }

            // SELECT MODE - check component for dragging
            var comp = findComponentAt(pos.x, pos.y);
            if (comp) {
                isDraggingComponent = true;
                dragComp = comp;
                dragOffset.x = pos.x - comp.x * canvas.width;
                dragOffset.y = pos.y - comp.y * canvas.height;
                dragStartPos = { x: pos.x, y: pos.y };
                dragMoved = false;
                return;
            }

            // Clicked empty space - deselect
            selectedTerminalId = null;
        }

        function handlePointerMove(pos) {
            mousePos = pos;
            hoverTerminal = findTerminalAt(pos.x, pos.y);

            if (isDraggingComponent && dragComp) {
                var newX = (pos.x - dragOffset.x) / canvas.width;
                var newY = (pos.y - dragOffset.y) / canvas.height;
                dragComp.x = Math.max(0.05, Math.min(0.95, newX));
                dragComp.y = Math.max(0.05, Math.min(0.95, newY));
                var dist = Math.sqrt(
                    Math.pow(pos.x - dragStartPos.x, 2) + Math.pow(pos.y - dragStartPos.y, 2)
                );
                if (dist > 5) dragMoved = true;
                recalcTerminals();
            }

            if (isDrawingWire) {
                wireToPos = pos;
            }
        }

        function handlePointerUp(pos) {
            // Finish component drag
            if (isDraggingComponent && dragComp) {
                if (!dragMoved && dragComp.type === COMP.SWITCH) {
                    switchStates[dragComp.id] = !switchStates[dragComp.id];
                }
                isDraggingComponent = false;
                dragComp = null;
                return;
            }

            // Finish wire drawing
            if (isDrawingWire && wireFromId) {
                var t = findTerminalAt(pos.x, pos.y);
                if (t && t.id !== wireFromId) {
                    tryConnect(wireFromId, t);
                    selectedTerminalId = null;
                }
                isDrawingWire = false;
                wireFromId = null;
                wireToPos = null;
                return;
            }
        }

        // Mouse events
        canvas.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            handlePointerDown(getPointerPos(e));
        }, true);

        canvas.addEventListener('mousemove', function (e) {
            handlePointerMove(getPointerPos(e));
        }, true);

        document.addEventListener('mouseup', function (e) {
            handlePointerUp(getPointerPos(e));
        });

        // Touch events
        canvas.addEventListener('touchstart', function (e) {
            e.preventDefault();
            handlePointerDown(getPointerPos(e));
        }, { passive: false, capture: true });

        canvas.addEventListener('touchmove', function (e) {
            e.preventDefault();
            handlePointerMove(getPointerPos(e));
        }, { passive: false, capture: true });

        canvas.addEventListener('touchend', function (e) {
            e.preventDefault();
            handlePointerUp(getPointerPos(e));
        }, { passive: false, capture: true });

        // Right-click to remove wires from a terminal
        canvas.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            var pos = getPointerPos(e);
            var t = findTerminalAt(pos.x, pos.y);
            if (t) {
                wires = wires.filter(function (w) {
                    return w.from !== t.id && w.to !== t.id;
                });
                selectedTerminalId = null;
            }
        });

        // Double-click to remove a specific wire
        canvas.addEventListener('dblclick', function (e) {
            e.preventDefault();
            var pos = getPointerPos(e);
            removeWireAt(pos.x, pos.y);
        });

        // ===== RENDER LOOP =====
        function render() {
            resizeCanvas();
            recalcTerminals();
            drawBackground();

            var size = Math.min(canvas.width, canvas.height) * 0.055;
            var adj = buildGraph();
            var bulbStates = getBulbStates(adj);

            // Build connected terminals set
            var connectedTerminals = {};
            wires.forEach(function (w) {
                connectedTerminals[w.from] = true;
                connectedTerminals[w.to] = true;
            });

            // Draw wires
            var batteries = components.filter(function (c) { return c.type === COMP.BATTERY; });
            wires.forEach(function (w) {
                var fromT = findTerminal(w.from);
                var toT = findTerminal(w.to);
                if (fromT && toT) {
                    var isActive = false;
                    for (var b = 0; b < batteries.length; b++) {
                        var reach = bfsReachable(adj, batteries[b].id + '_pos');
                        if (reach[batteries[b].id + '_neg'] && reach[w.from] && reach[w.to]) {
                            isActive = true;
                            break;
                        }
                    }
                    drawWire(fromT, toT, isActive);
                }
            });

            // Draw active wire being drawn
            if (isDrawingWire && wireFromId && wireToPos) {
                var fromT = findTerminal(wireFromId);
                if (fromT) drawDragWire(fromT, wireToPos);
            }
            if (selectedTerminalId && !isDrawingWire) {
                var selT = findTerminal(selectedTerminalId);
                if (selT) {
                    drawDragWire(selT, mousePos);
                    var pulseSize = Math.min(canvas.width, canvas.height) * 0.035;
                    var pulse2 = 0.5 + 0.5 * Math.sin(Date.now() * 0.006);
                    ctx.strokeStyle = 'rgba(255,152,0,' + (0.5 + pulse2 * 0.5) + ')';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(selT.x, selT.y, pulseSize, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }

            // Draw components
            components.forEach(function (comp) {
                if (comp.type === COMP.BATTERY) drawBattery(comp, size);
                else if (comp.type === COMP.BULB) drawBulb(comp, size, !!bulbStates[comp.id]);
                else if (comp.type === COMP.SWITCH) drawSwitch(comp, size);
            });

            // Draw delete highlights
            if (currentTool === 'delete') {
                var hoverComp = findComponentAt(mousePos.x, mousePos.y);
                if (hoverComp) {
                    drawDeleteHighlight(hoverComp, size);
                }
            }

            // Draw terminals
            terminals.forEach(function (t) {
                var isHover = hoverTerminal && hoverTerminal.id === t.id;
                var isActive = !!connectedTerminals[t.id];
                drawTerminal(t, isHover, isActive);
            });

            // Ghost preview for add mode
            if (currentTool !== 'select' && currentTool !== 'delete' && mousePos.x > 0 && mousePos.y > 0) {
                drawGhostComponent(currentTool, mousePos.x, mousePos.y, size);
            }

            // Sparks
            updateAndDrawSparks();

            // Hint text for empty canvas
            drawHint();

            animFrame = requestAnimationFrame(render);
        }

        // ===== SAVE / RESTORE =====
        env.getEnvironment(function (err, environment) {
            if (environment.objectId) {
                activity.getDatastoreObject().loadAsText(function (error, metadata, data) {
                    if (error == null && data != null) {
                        try {
                            var state = JSON.parse(data);
                            if (state.components) components = state.components;
                            if (state.wires) wires = state.wires;
                            if (state.switchStates) switchStates = state.switchStates;
                            if (state.nextId) nextId = state.nextId;
                            recalcTerminals();
                        } catch (e) {
                            console.log('[CircuitBuilder] Error loading state:', e);
                        }
                    }
                });
            }

            document.getElementById('stop-button').addEventListener('click', function (e) {
                var state = {
                    components: components,
                    wires: wires,
                    switchStates: switchStates,
                    nextId: nextId
                };
                var jsonData = JSON.stringify(state);
                activity.getDatastoreObject().setDataAsText(jsonData);
                activity.getDatastoreObject().save(function () {
                    console.log('[CircuitBuilder] State saved');
                });
            });
        });

        // ===== INIT =====
        updateToolbarHighlight();
        updateCursor();
        render();

    });
});
