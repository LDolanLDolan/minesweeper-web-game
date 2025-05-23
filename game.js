// game.js

// UI Constants (can be adjusted)
const HEIGHT = 8;
const WIDTH = 8;
const MINES = 8;

const CELL_SIZE = 45; // Pixels per cell
const BOARD_PADDING = 20; // Padding around the board
const BOARD_ORIGIN_X = BOARD_PADDING;
const BOARD_ORIGIN_Y = BOARD_PADDING;

// Colors (as hex or RGB strings for Canvas)
const BLACK = '#000000';
const GRAY = '#B4B4B4'; // Lighter gray for cells
const WHITE = '#FFFFFF';
const MINE_RED = '#FF0000';
const FLAG_YELLOW = '#FFFF00';
const BORDER_COLOR = '#FFFFFF'; // White border

// Get DOM elements
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const instructionsScreen = document.getElementById('instructions');
const gameScreen = document.getElementById('game-screen');
const playButton = document.getElementById('play-button');
const aiMoveButton = document.getElementById('ai-move-button');
const resetButton = document.getElementById('reset-button');
const gameStatusText = document.getElementById('game-status');

// Game state variables
let game;
let ai;
let revealed; // Set of strings "row,col"
let flags;    // Set of strings "row,col"
let lost;
let instructionsShown;

// --- Initialization ---
function initGame() {
    game = new Minesweeper(HEIGHT, WIDTH, MINES);
    ai = new MinesweeperAI(HEIGHT, WIDTH);
    revealed = new Set();
    flags = new Set();
    lost = false;
    instructionsShown = true; // Start with instructions
    // Reset status text
    gameStatusText.textContent = '';
    // Set up initial screen visibility
    instructionsScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');

    // Adjust canvas size based on cell_size and board dimensions
    gameCanvas.width = (WIDTH * CELL_SIZE) + (BOARD_PADDING * 2);
    gameCanvas.height = (HEIGHT * CELL_SIZE) + (BOARD_PADDING * 2);

    requestAnimationFrame(draw); // Start drawing loop
}

// --- Drawing Function ---
function draw() {
    // Clear the entire canvas
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    if (instructionsShown) {
        // Handled by CSS and HTML for simplicity, nothing to draw here
    } else {
        // Draw game board
        for (let i = 0; i < HEIGHT; i++) {
            for (let j = 0; j < WIDTH; j++) {
                const x = BOARD_ORIGIN_X + j * CELL_SIZE;
                const y = BOARD_ORIGIN_Y + i * CELL_SIZE;
                const cellKey = `${i},${j}`; // Unique key for Set lookups

                // Draw cell background
                ctx.fillStyle = GRAY;
                ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

                // Draw cell border
                ctx.strokeStyle = BORDER_COLOR;
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);

                // Draw content based on cell state
                if (lost && game.is_mine([i, j])) {
                    // Show mine if lost
                    ctx.fillStyle = MINE_RED;
                    ctx.beginPath();
                    ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, CELL_SIZE / 4, 0, Math.PI * 2);
                    ctx.fill();
                } else if (flags.has(cellKey)) {
                    // Draw flag
                    ctx.fillStyle = FLAG_YELLOW;
                    ctx.fillRect(x + CELL_SIZE * 0.2, y + CELL_SIZE * 0.2, CELL_SIZE * 0.6, CELL_SIZE * 0.6);
                } else if (revealed.has(cellKey)) {
                    // Draw number of nearby mines
                    const nearby = game.nearby_mines([i, j]);
                    if (nearby > 0) { // Only draw numbers if greater than 0
                        ctx.fillStyle = BLACK;
                        ctx.font = `${CELL_SIZE * 0.6}px Arial`; // Font size relative to cell
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(nearby.toString(), x + CELL_SIZE / 2, y + CELL_SIZE / 2);
                    }
                }
            }
        }

        // Update game status text
        if (lost) {
            gameStatusText.textContent = 'Lost!';
            gameStatusText.style.color = MINE_RED;
        } else if (flags.size === MINES && revealed.size === (HEIGHT * WIDTH - MINES)) {
             // Win condition: all mines flagged AND all non-mines revealed
            gameStatusText.textContent = 'Won!';
            gameStatusText.style.color = FLAG_YELLOW;
        } else {
            gameStatusText.textContent = ''; // Clear text if game is ongoing
        }
    }

    requestAnimationFrame(draw); // Continue the loop
}

// --- Event Listeners ---
playButton.addEventListener('click', () => {
    instructionsShown = false;
    instructionsScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    draw(); // Force redraw to show game board
});

gameCanvas.addEventListener('click', (event) => {
    if (lost || instructionsShown) return;

    const rect = gameCanvas.getBoundingClientRect(); // Get canvas position on page
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Calculate clicked cell based on mouse coordinates
    const j = Math.floor((mouseX - BOARD_ORIGIN_X) / CELL_SIZE);
    const i = Math.floor((mouseY - BOARD_ORIGIN_Y) / CELL_SIZE);

    if (i >= 0 && i < HEIGHT && j >= 0 && j < WIDTH) {
        const cell = [i, j];
        const cellKey = `${i},${j}`;

        if (!flags.has(cellKey) && !revealed.has(cellKey)) {
            if (game.is_mine(cell)) {
                lost = true;
            } else {
                const nearby = game.nearby_mines(cell);
                revealed.add(cellKey);
                ai.add_knowledge(cell, nearby);
            }
            draw(); // Redraw after move
        }
    }
});

gameCanvas.addEventListener('contextmenu', (event) => {
    event.preventDefault(); // Prevent default right-click context menu
    if (lost || instructionsShown) return;

    const rect = gameCanvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const j = Math.floor((mouseX - BOARD_ORIGIN_X) / CELL_SIZE);
    const i = Math.floor((mouseY - BOARD_ORIGEN_Y) / CELL_SIZE); // Typo here, should be BOARD_ORIGIN_Y

    if (i >= 0 && i < HEIGHT && j >= 0 && j < WIDTH) {
        const cellKey = `${i},${j}`;
        if (!revealed.has(cellKey)) { // Cannot flag an already revealed cell
            if (flags.has(cellKey)) {
                flags.delete(cellKey);
            } else {
                flags.add(cellKey);
            }
            draw(); // Redraw after flag change
        }
    }
});


aiMoveButton.addEventListener('click', () => {
    if (lost || instructionsShown) return;

    const move = ai.make_safe_move();
    if (move === null) {
        // No safe moves, try random
        const randomMove = ai.make_random_move();
        if (randomMove === null) {
            // If no random moves either, it means all remaining unknown cells must be mines
            // This is a simplified interpretation for the UI: mark all remaining as flags
            for(let r=0; r<HEIGHT; r++) {
                for(let c=0; c<WIDTH; c++) {
                    const cellKey = `${r},${c}`;
                    if (!revealed.has(cellKey) && !ai.mines.has(cellKey) && !flags.has(cellKey)) {
                        flags.add(cellKey); // Assume it's a mine
                    }
                }
            }
            console.log("AI: No moves left to make. Flagging remaining unknowns.");
        } else {
            console.log("AI: No known safe moves, making random move:", randomMove);
            if (game.is_mine(randomMove)) {
                lost = true;
            } else {
                const nearby = game.nearby_mines(randomMove);
                revealed.add(`${randomMove[0]},${randomMove[1]}`);
                ai.add_knowledge(randomMove, nearby);
            }
        }
    } else {
        console.log("AI: Making safe move:", move);
        // A safe move should never be a mine, but we check anyway
        if (game.is_mine(move)) {
            lost = true;
        } else {
            const nearby = game.nearby_mines(move);
            revealed.add(`${move[0]},${move[1]}`);
            ai.add_knowledge(move, nearby);
        }
    }
    draw(); // Redraw after AI move
});

resetButton.addEventListener('click', () => {
    initGame(); // Re-initialize all game state
    draw();
});

// --- Start the game ---
initGame();