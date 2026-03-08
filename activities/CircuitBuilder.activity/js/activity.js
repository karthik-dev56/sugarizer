define(["sugar-web/activity/activity", "sugar-web/env"], function (activity, env) {

    // Manipulate the DOM only when it is ready.
    requirejs(['domReady!'], function (doc) {

        // Initialize the activity.
        activity.setup();

        

        var canvas = document.getElementById('circuit-canvas');
        var ctx = canvas.getContext('2d');
        var levelLabel = document.getElementById('level-label');
        var levelDescription = document.getElementById('level-description');
        var wireCountElem = document.getElementById('wire-count');
        var messageOverlay = document.getElementById('message-overlay');
        var messageText = document.getElementById('message-text');
        var messageIcon = document.getElementById('message-icon');
        var messageBtn = document.getElementById('message-btn');

        // State
        var currentLevel = 0;
        var wires = [];
        var selectedTerminalId = null;  
        var components = [];
        var terminals = [];
        var animFrame = null;
        var glowingBulbs = [];
        var sparkParticles = [];
        var switchStates = {};

        console.log('[CircuitBuilder] Activity loaded');

       
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
            bulbGlowOn: 'rgba(255,255,100,0.35)',
            bulbFilament: '#888888',
            bulbFilamentOn: '#FF8800',
            bulbBase: '#AAAAAA',
            switchBody: '#FFAB91',
            switchBodyOn: '#66BB6A',
            switchKnob: '#FF5722',
            switchKnobOn: '#2E7D32',
            text: '#FFFFFF',
            gridDot: 'rgba(0,0,0,0.08)'
        };

        // Component types
        var COMP = {
            BATTERY: 'battery',
            BULB: 'bulb',
            SWITCH: 'switch'
        };

   
        var levels = [
            {
                // Level 1: Simple battery + 1 bulb
                description: 'Connect the battery to the light bulb',
                maxWires: -1, // unlimited
                components: [
                    { type: COMP.BATTERY, x: 0.22, y: 0.45, id: 'bat1' },
                    { type: COMP.BULB, x: 0.65, y: 0.40, id: 'bulb1' }
                ],

                winCondition: function(graph) {
                    return checkClosedCircuit(graph, ['bat1'], ['bulb1'], []);
                }
            },
            {
             
                description: 'Light up two bulbs in series',
                maxWires: -1,
                components: [
                    { type: COMP.BATTERY, x: 0.15, y: 0.45, id: 'bat1' },
                    { type: COMP.BULB, x: 0.45, y: 0.35, id: 'bulb1' },
                    { type: COMP.BULB, x: 0.75, y: 0.50, id: 'bulb2' }
                ],
                winCondition: function(graph) {
                    return checkClosedCircuit(graph, ['bat1'], ['bulb1', 'bulb2'], []);
                }
            },
            {
                // Level 3: Battery + switch + bulb
                description: 'Use the switch to control the bulb',
                maxWires: -1,
                components: [
                    { type: COMP.BATTERY, x: 0.18, y: 0.45, id: 'bat1' },
                    { type: COMP.SWITCH, x: 0.45, y: 0.45, id: 'sw1' },
                    { type: COMP.BULB, x: 0.72, y: 0.40, id: 'bulb1' }
                ],
                winCondition: function(graph) {
                    return checkClosedCircuit(graph, ['bat1'], ['bulb1'], ['sw1']);
                }
            },
            {
                // Level 4: Battery + 2 bulbs with limited wires
                description: 'Light up two bulbs with only 4 wires',
                maxWires: 4,
                components: [
                    { type: COMP.BATTERY, x: 0.15, y: 0.45, id: 'bat1' },
                    { type: COMP.BULB, x: 0.45, y: 0.30, id: 'bulb1' },
                    { type: COMP.BULB, x: 0.75, y: 0.55, id: 'bulb2' }
                ],
                winCondition: function(graph) {
                    return checkClosedCircuit(graph, ['bat1'], ['bulb1', 'bulb2'], []);
                }
            },
            {
                // Level 5: Parallel circuit - battery + 2 bulbs in parallel
                description: 'Build a parallel circuit for two bulbs',
                maxWires: -1,
                components: [
                    { type: COMP.BATTERY, x: 0.15, y: 0.45, id: 'bat1' },
                    { type: COMP.BULB, x: 0.60, y: 0.25, id: 'bulb1' },
                    { type: COMP.BULB, x: 0.60, y: 0.65, id: 'bulb2' }
                ],
                winCondition: function(graph) {
                    return checkParallelCircuit(graph, 'bat1', ['bulb1', 'bulb2']);
                }
            }
        ];

        
        function getTerminalsForComponent(comp, cw, ch) {
            var cx = comp.x * cw;
            var cy = comp.y * ch;
            var size = Math.min(cw, ch) * 0.055;
            var ts = [];

            if (comp.type === COMP.BATTERY) {
                // Top terminal (+) and bottom terminal (-)
                ts.push({ id: comp.id + '_pos', compId: comp.id, type: 'pos', x: cx, y: cy - size * 1.6, compType: comp.type });
                ts.push({ id: comp.id + '_neg', compId: comp.id, type: 'neg', x: cx, y: cy + size * 1.6, compType: comp.type });
            } else if (comp.type === COMP.BULB) {
                // Left terminal and right terminal
                ts.push({ id: comp.id + '_a', compId: comp.id, type: 'a', x: cx - size * 1.3, y: cy + size * 0.6, compType: comp.type });
                ts.push({ id: comp.id + '_b', compId: comp.id, type: 'b', x: cx + size * 1.3, y: cy + size * 0.6, compType: comp.type });
            } else if (comp.type === COMP.SWITCH) {
                ts.push({ id: comp.id + '_a', compId: comp.id, type: 'a', x: cx - size * 1.5, y: cy, compType: comp.type });
                ts.push({ id: comp.id + '_b', compId: comp.id, type: 'b', x: cx + size * 1.5, y: cy, compType: comp.type });
            }
            return ts;
        }


        function buildGraph() {
            
            var adj = {};
            terminals.forEach(function(t) { adj[t.id] = []; });

            components.forEach(function(comp) {
                var compTerminals = terminals.filter(function(t) { return t.compId === comp.id; });
                if (compTerminals.length === 2) {
                    var a = compTerminals[0].id;
                    var b = compTerminals[1].id;
                    if (comp.type === COMP.BATTERY) {
         
                    } else if (comp.type === COMP.SWITCH) {
                        if (switchStates[comp.id]) {
                            adj[a].push(b);
                            adj[b].push(a);
                        }
                    } else {
                        adj[a].push(b);
                        adj[b].push(a);
                    }
                }
            });

            // Wire connections
            wires.forEach(function(w) {
                adj[w.from].push(w.to);
                adj[w.to].push(w.from);
            });

            return adj;
        }

        function bfsReachable(adj, start) {
            var visited = {};
            var queue = [start];
            visited[start] = true;
            while (queue.length > 0) {
                var node = queue.shift();
                (adj[node] || []).forEach(function(neighbor) {
                    if (!visited[neighbor]) {
                        visited[neighbor] = true;
                        queue.push(neighbor);
                    }
                });
            }
            return visited;
        }

        function checkClosedCircuit(graph, batteryIds, bulbIds, switchIds) {
            var adj = graph;
         
            for (var b = 0; b < batteryIds.length; b++) {
                var posId = batteryIds[b] + '_pos';
                var negId = batteryIds[b] + '_neg';
                var reachable = bfsReachable(adj, posId);
                if (!reachable[negId]) return false;
            }

            for (var i = 0; i < bulbIds.length; i++) {
                var aId = bulbIds[i] + '_a';
                var bId = bulbIds[i] + '_b';
                var reach = bfsReachable(adj, batteryIds[0] + '_pos');
                if (!reach[aId] || !reach[bId]) return false;
            }

            return true;
        }

        function checkParallelCircuit(graph, batteryId, bulbIds) {
            var adj = graph;
            var posId = batteryId + '_pos';
            var negId = batteryId + '_neg';
            var reach = bfsReachable(adj, posId);
            if (!reach[negId]) return false;

            for (var i = 0; i < bulbIds.length; i++) {
                var aId = bulbIds[i] + '_a';
                var bId = bulbIds[i] + '_b';
                if (!reach[aId] || !reach[bId]) return false;
            }
            return true;
        }

        function getBulbStates(adj) {
            var states = {};
            components.forEach(function(comp) {
                if (comp.type !== COMP.BULB) return;
                var aId = comp.id + '_a';
                var bId = comp.id + '_b';
                var batComp = components.find(function(c) { return c.type === COMP.BATTERY; });
                if (!batComp) { states[comp.id] = false; return; }
                var posId = batComp.id + '_pos';
                var negId = batComp.id + '_neg';
                var reachFromPos = bfsReachable(adj, posId);
                states[comp.id] = !!(reachFromPos[aId] && reachFromPos[bId] && reachFromPos[negId]);
            });
            return states;
        }

        // DRAWING FUNCTIONS
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

        function drawBattery(comp, size) {
            var cx = comp.x * canvas.width;
            var cy = comp.y * canvas.height;
            var w = size * 1.4;
            var h = size * 2.2;

            // Battery cap (top positive terminal)
            ctx.fillStyle = '#888888';
            var capW = w * 0.4;
            var capH = h * 0.12;
            ctx.beginPath();
            drawRoundRect(cx - capW / 2, cy - h / 2 - capH, capW, capH, 2);
            ctx.fill();

            // Battery body
            ctx.fillStyle = COLORS.batteryTop;
            ctx.beginPath();
            drawRoundRect(cx - w / 2, cy - h / 2, w, h * 0.4, [4, 4, 0, 0]);
            ctx.fill();

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
            ctx.fillText('−', cx, cy + h * 0.22);
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

            // Bulb glass
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
            
            // Outer glow ring to show it's interactive
            if (isHover) {
                ctx.fillStyle = 'rgba(255,152,0,0.3)';
                ctx.beginPath();
                ctx.arc(t.x, t.y, radius * 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Pulsing ring around all terminals
            var pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.003);
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.2 + pulse * 0.3) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(t.x, t.y, radius * 1.3, 0, Math.PI * 2);
            ctx.stroke();

            // Main terminal circle
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

            // Draw as a nice curved wire
            var dx = toT.x - fromT.x;
            var dy = toT.y - fromT.y;
            var mx = (fromT.x + toT.x) / 2;
            var my = (fromT.y + toT.y) / 2;

            // Slight curve offset
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

        // Spark particles for wire connections
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
            sparkParticles.forEach(function(p) {
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

        // MAIN RENDER LOOP
        var hoverTerminal = null;
        var connectedTerminals = {};

        function render() {
            resizeCanvas();

            recalcTerminals();

            drawBackground();

            var size = Math.min(canvas.width, canvas.height) * 0.055;

            var adj = buildGraph();
            var bulbStates = getBulbStates(adj);

            // Build set of connected terminals
            connectedTerminals = {};
            wires.forEach(function(w) {
                connectedTerminals[w.from] = true;
                connectedTerminals[w.to] = true;
            });

            // Draw wires
            wires.forEach(function(w) {
                var fromT = findTerminal(w.from);
                var toT = findTerminal(w.to);
                if (fromT && toT) {
                    var bat = components.find(function(c) { return c.type === COMP.BATTERY; });
                    var isActive = false;
                    if (bat) {
                        var reach = bfsReachable(adj, bat.id + '_pos');
                        isActive = reach[bat.id + '_neg'] && reach[w.from] && reach[w.to];
                    }
                    drawWire(fromT, toT, isActive);
                }
            });

            if (dragActive && dragFromId && dragToPos) {
                var dragFromTerminal = findTerminal(dragFromId);
                if (dragFromTerminal) {
                    drawDragWire(dragFromTerminal, dragToPos);
                }
            }
            if (selectedTerminalId && !dragActive) {
                var selT = findTerminal(selectedTerminalId);
                if (selT) {
                    drawDragWire(selT, mousePos);
                    // Highlight the selected terminal
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
            components.forEach(function(comp) {
                if (comp.type === COMP.BATTERY) {
                    drawBattery(comp, size);
                } else if (comp.type === COMP.BULB) {
                    drawBulb(comp, size, !!bulbStates[comp.id]);
                } else if (comp.type === COMP.SWITCH) {
                    drawSwitch(comp, size);
                }
            });

            // Draw terminals
            terminals.forEach(function(t) {
                var isHover = hoverTerminal && hoverTerminal.id === t.id;
                var isActive = !!connectedTerminals[t.id];
                drawTerminal(t, isHover, isActive);
            });

            // Draw sparks
            updateAndDrawSparks();

            animFrame = requestAnimationFrame(render);
        }

        function recalcTerminals() {
            terminals = [];
            var level = levels[currentLevel];
            level.components.forEach(function(comp) {
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
            for (var i = 0; i < components.length; i++) {
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

   
        // INPUT HANDLING (Click-to-select + drag support)
        var dragActive = false;
        var dragFromId = null;
        var dragToPos = null;
        var mousePos = { x: 0, y: 0 };

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
            var exists = wires.some(function(w) {
                return (w.from === fromId && w.to === toTerminal.id) ||
                       (w.from === toTerminal.id && w.to === fromId);
            });
            if (exists) return false;
            // Check wire limit
            var level = levels[currentLevel];
            var canAdd = level.maxWires < 0 || wires.length < level.maxWires;
            if (!canAdd) return false;

            wires.push({ from: fromId, to: toTerminal.id });
            console.log('[CircuitBuilder] Wire added:', fromId, '->', toTerminal.id);
            addSparks(toTerminal.x, toTerminal.y);
            addSparks(fromTerminal.x, fromTerminal.y);
            updateWireCount();
            return true;
        }

     
        canvas.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return; // left click only
            e.preventDefault();
            e.stopPropagation();
            var pos = getPointerPos(e);
            mousePos = pos;
            console.log('[CircuitBuilder] mousedown at', pos.x.toFixed(0), pos.y.toFixed(0));

            var t = findTerminalAt(pos.x, pos.y);
            if (t) {
                if (selectedTerminalId && selectedTerminalId !== t.id) {
                    if (tryConnect(selectedTerminalId, t)) {
                        selectedTerminalId = null;
                        return;
                    }
                }
                // Start drag and/or select this terminal
                dragActive = true;
                dragFromId = t.id;
                dragToPos = pos;
                selectedTerminalId = t.id;
                console.log('[CircuitBuilder] Selected terminal:', t.id);
                return;
            }

            selectedTerminalId = null;
            dragActive = false;
            dragFromId = null;

   
            var comp = findComponentAt(pos.x, pos.y);
            if (comp && comp.type === COMP.SWITCH) {
                switchStates[comp.id] = !switchStates[comp.id];
                console.log('[CircuitBuilder] Toggled switch:', comp.id);
            }
        }, true);

        canvas.addEventListener('mousemove', function(e) {
            var pos = getPointerPos(e);
            mousePos = pos;
            hoverTerminal = findTerminalAt(pos.x, pos.y);
            if (dragActive) {
                dragToPos = pos;
            }
        }, true);

        document.addEventListener('mouseup', function(e) {
            if (!dragActive || !dragFromId) {
                dragActive = false;
                return;
            }
            var pos = getPointerPos(e);
            var t = findTerminalAt(pos.x, pos.y);
            console.log('[CircuitBuilder] mouseup, target:', t ? t.id : 'none');

            if (t && t.id !== dragFromId) {
                tryConnect(dragFromId, t);
                selectedTerminalId = null;
            }

            dragActive = false;
            dragFromId = null;
            dragToPos = null;
        });

        // Touch support
        canvas.addEventListener('touchstart', function(e) {
            e.preventDefault();
            var pos = getPointerPos(e);
            console.log('[CircuitBuilder] touchstart at', pos.x.toFixed(0), pos.y.toFixed(0));

            var t = findTerminalAt(pos.x, pos.y);
            if (t) {
                if (selectedTerminalId && selectedTerminalId !== t.id) {
                    if (tryConnect(selectedTerminalId, t)) {
                        selectedTerminalId = null;
                        return;
                    }
                }
                dragActive = true;
                dragFromId = t.id;
                dragToPos = pos;
                selectedTerminalId = t.id;
                return;
            }

            selectedTerminalId = null;
            dragActive = false;

            var comp = findComponentAt(pos.x, pos.y);
            if (comp && comp.type === COMP.SWITCH) {
                switchStates[comp.id] = !switchStates[comp.id];
            }
        }, { passive: false, capture: true });

        canvas.addEventListener('touchmove', function(e) {
            e.preventDefault();
            var pos = getPointerPos(e);
            mousePos = pos;
            hoverTerminal = findTerminalAt(pos.x, pos.y);
            if (dragActive) {
                dragToPos = pos;
            }
        }, { passive: false, capture: true });

        canvas.addEventListener('touchend', function(e) {
            e.preventDefault();
            if (!dragActive || !dragFromId) {
                dragActive = false;
                return;
            }
            var pos = getPointerPos(e);
            var t = findTerminalAt(pos.x, pos.y);
            if (t && t.id !== dragFromId) {
                tryConnect(dragFromId, t);
                selectedTerminalId = null;
            }
            dragActive = false;
            dragFromId = null;
            dragToPos = null;
        }, { passive: false, capture: true });

        // Right-click to remove wires from a terminal
        canvas.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            var pos = getPointerPos(e);
            var t = findTerminalAt(pos.x, pos.y);
            if (t) {
                wires = wires.filter(function(w) {
                    return w.from !== t.id && w.to !== t.id;
                });
                updateWireCount();
                selectedTerminalId = null;
            }
        });

        canvas.addEventListener('dblclick', function(e) {
            e.preventDefault();
            var pos = getPointerPos(e);
            var closestIdx = -1;
            var closestDist = 25;
            wires.forEach(function(w, idx) {
                var fromT = findTerminal(w.from);
                var toT = findTerminal(w.to);
                if (fromT && toT) {
                    var d = distToSegment(pos, fromT, toT);
                    if (d < closestDist) {
                        closestDist = d;
                        closestIdx = idx;
                    }
                }
            });
            if (closestIdx >= 0) {
                wires.splice(closestIdx, 1);
                updateWireCount();
            }
        });

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

        // LEVEL MANAGEMENT
        function loadLevel(idx) {
            if (idx < 0) idx = 0;
            if (idx >= levels.length) idx = levels.length - 1;
            currentLevel = idx;
            var level = levels[currentLevel];
            components = level.components.slice();
            wires = [];
            switchStates = {};
            sparkParticles = [];
            glowingBulbs = [];
            selectedTerminalId = null;
            dragActive = false;
            dragFromId = null;
            dragToPos = null;

            // Initialize switches to off
            components.forEach(function(comp) {
                if (comp.type === COMP.SWITCH) {
                    switchStates[comp.id] = false;
                }
            });

            updateUI();
        }

        function updateUI() {
            var level = levels[currentLevel];
            levelLabel.textContent = 'Level ' + (currentLevel + 1);
            levelDescription.textContent = level.description;
            updateWireCount();

            // Enable/disable nav buttons
            document.getElementById('prev-button').style.opacity = currentLevel > 0 ? '1' : '0.3';
            document.getElementById('next-button').style.opacity = currentLevel < levels.length - 1 ? '1' : '0.3';
        }

        function updateWireCount() {
            var level = levels[currentLevel];
            if (level.maxWires > 0) {
                wireCountElem.textContent = 'Wires: ' + wires.length + '/' + level.maxWires;
                wireCountElem.style.display = '';
            } else {
                wireCountElem.style.display = 'none';
            }
        }

        function checkCircuit() {
            var adj = buildGraph();
            var level = levels[currentLevel];
            var success = level.winCondition(adj);

            if (success) {
                showMessage(
                    '🎉',
                    'Congratulations! The circuit is complete and the bulbs light up!',
                    currentLevel < levels.length - 1 ? 'Next Level' : 'All Done!',
                    currentLevel < levels.length - 1 ? 'next' : 'done'
                );
            } else {
                showMessage(
                    '💡',
                    'Not all bulbs are lit yet. Keep trying! Make sure the circuit forms a complete loop.',
                    'Try Again',
                    'retry'
                );
            }
        }

        function showMessage(icon, text, btnText, action) {
            messageIcon.textContent = icon;
            messageText.textContent = text;
            messageBtn.textContent = btnText;
            messageBtn.className = '';
            if (action === 'retry') messageBtn.className = 'try-again';
            if (action === 'done') messageBtn.className = 'all-done';
            messageOverlay.classList.remove('hidden');

            messageBtn.onclick = function() {
                messageOverlay.classList.add('hidden');
                if (action === 'next') {
                    loadLevel(currentLevel + 1);
                } else if (action === 'done') {
                    loadLevel(0);
                }
               
            };
        }

        // TOOLBAR BUTTONS
        document.getElementById('reset-button').addEventListener('click', function() {
            loadLevel(currentLevel);
        });

        document.getElementById('check-button').addEventListener('click', function() {
            checkCircuit();
        });

        document.getElementById('prev-button').addEventListener('click', function() {
            if (currentLevel > 0) {
                loadLevel(currentLevel - 1);
            }
        });

        document.getElementById('next-button').addEventListener('click', function() {
            if (currentLevel < levels.length - 1) {
                loadLevel(currentLevel + 1);
            }
        });

        // Fullscreen
        document.getElementById('fullscreen-button').addEventListener('click', function() {
            document.getElementById('main-toolbar').style.display = 'none';
            document.getElementById('canvas').style.top = '0px';
            document.getElementById('unfullscreen-button').style.visibility = 'visible';
        });

        document.getElementById('unfullscreen-button').addEventListener('click', function() {
            document.getElementById('main-toolbar').style.display = '';
            document.getElementById('canvas').style.top = '55px';
            document.getElementById('unfullscreen-button').style.visibility = 'hidden';
        });

        // SAVE / RESTORE STATE
        env.getEnvironment(function(err, environment) {
            // Restore state if available
            if (environment.objectId) {
                activity.getDatastoreObject().loadAsText(function(error, metadata, data) {
                    if (error == null && data != null) {
                        try {
                            var state = JSON.parse(data);
                            if (state.currentLevel !== undefined) {
                                currentLevel = state.currentLevel;
                                loadLevel(currentLevel);
                                if (state.wires) wires = state.wires;
                                if (state.switchStates) switchStates = state.switchStates;
                                updateWireCount();
                            }
                        } catch(e) {
                            loadLevel(0);
                        }
                    } else {
                        loadLevel(0);
                    }
                });
            } else {
                loadLevel(0);
            }

            // Save state on stop
            document.getElementById('stop-button').addEventListener('click', function(e) {
                var state = {
                    currentLevel: currentLevel,
                    wires: wires,
                    switchStates: switchStates
                };
                var jsonData = JSON.stringify(state);
                activity.getDatastoreObject().setDataAsText(jsonData);
                activity.getDatastoreObject().save(function() {
                    
                });
            });
        });

        // ROUNDRECT HELPER (avoids polyfill issues)
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

        loadLevel(0);
        render();

    });
});
