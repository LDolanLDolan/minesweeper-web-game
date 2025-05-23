// minesweeper_logic.js

class Minesweeper {
    constructor(height = 8, width = 8, mines = 8) {
        this.height = height;
        this.width = width;
        this.mines = new Set(); // Stores mine cells as strings "row,col"

        this.board = [];
        for (let i = 0; i < this.height; i++) {
            this.board.push(Array(this.width).fill(false)); // false means no mine
        }

        // Add mines randomly
        let minesAdded = 0;
        while (minesAdded < mines) {
            const i = Math.floor(Math.random() * height);
            const j = Math.floor(Math.random() * width);
            const cellKey = `${i},${j}`;
            if (!this.board[i][j]) { // If not already a mine
                this.mines.add(cellKey);
                this.board[i][j] = true;
                minesAdded++;
            }
        }

        this.mines_found = new Set(); // Not directly used in this UI, but kept for consistency
    }

    is_mine(cell) {
        const [i, j] = cell;
        return this.board[i][j];
    }

    nearby_mines(cell) {
        const [ci, cj] = cell;
        let count = 0;

        for (let i = ci - 1; i <= ci + 1; i++) {
            for (let j = cj - 1; j <= cj + 1; j++) {
                if (i === ci && j === cj) { // Ignore the cell itself
                    continue;
                }
                if (i >= 0 && i < this.height && j >= 0 && j < this.width) {
                    if (this.board[i][j]) {
                        count++;
                    }
                }
            }
        }
        return count;
    }

    won() {
        // In the UI, win condition is flags == total mines, but this is the core logic check
        // For AI, this isn't strictly necessary as AI focuses on revealing safes
        // For a full game, you'd need to compare this.mines_found with this.mines
        return this.mines_found.size === this.mines.size;
    }
}

class Sentence {
    constructor(cells, count) {
        // Cells are stored as a Set of strings "row,col" for easy lookup
        this.cells = new Set(cells.map(c => `${c[0]},${c[1]}`));
        this.count = count;
    }

    // Custom equality check (not strictly needed for this AI but good practice)
    equals(other) {
        if (!(other instanceof Sentence)) return false;
        if (this.count !== other.count) return false;
        if (this.cells.size !== other.cells.size) return false;
        for (const cell of this.cells) {
            if (!other.cells.has(cell)) return false;
        }
        return true;
    }

    toString() {
        return `{${Array.from(this.cells).join(', ')}} = ${this.count}`;
    }

    known_mines() {
        if (this.count === this.cells.size && this.cells.size > 0) {
            return new Set(this.cells);
        }
        return null; // Return null if not known
    }

    known_safes() {
        if (this.count === 0 && this.cells.size > 0) {
            return new Set(this.cells);
        }
        return null; // Return null if not known
    }

    mark_mine(cell) {
        const cellKey = `${cell[0]},${cell[1]}`;
        if (this.cells.has(cellKey)) {
            this.cells.delete(cellKey);
            this.count -= 1;
        }
    }

    mark_safe(cell) {
        const cellKey = `${cell[0]},${cell[1]}`;
        if (this.cells.has(cellKey)) {
            this.cells.delete(cellKey);
        }
    }
}

class MinesweeperAI {
    constructor(height = 8, width = 8) {
        this.height = height;
        this.width = width;

        this.moves_made = new Set(); // Stores cells as strings "row,col"
        this.mines = new Set();      // Stores cells as strings "row,col"
        this.safes = new Set();      // Stores cells as strings "row,col"

        this.knowledge = []; // List of Sentence objects
    }

    // Helper to convert string "row,col" back to [row, col] array
    _parseCellKey(cellKey) {
        return cellKey.split(',').map(Number);
    }

    mark_mine(cell) {
        const cellKey = `${cell[0]},${cell[1]}`;
        this.mines.add(cellKey);
        // Deep copy knowledge to avoid modifying during iteration
        const knowledgeCopy = [...this.knowledge];
        for (const sentence of knowledgeCopy) {
            sentence.mark_mine(cell);
        }
        this.check_knowledge(); // Re-evaluate knowledge after marking
    }

    mark_safe(cell) {
        const cellKey = `${cell[0]},${cell[1]}`;
        this.safes.add(cellKey);
        // Deep copy knowledge to avoid modifying during iteration
        const knowledgeCopy = [...this.knowledge];
        for (const sentence of knowledgeCopy) {
            sentence.mark_safe(cell);
        }
        this.check_knowledge(); // Re-evaluate knowledge after marking
    }

    add_knowledge(cell, count) {
        const cellKey = `${cell[0]},${cell[1]}`;

        // 1) mark the cell as a move that has been made
        this.moves_made.add(cellKey);

        // 2) mark the cell as safe (will trigger knowledge updates)
        this.mark_safe(cell);

        // 3) add a new sentence to the AI's knowledge base
        const newSentenceCells = new Set();
        let currentCount = count;
        const neighborCells = this._return_neighbour_cells(cell);

        for (const nc of neighborCells) {
            const ncKey = `${nc[0]},${nc[1]}`;
            if (this.mines.has(ncKey)) {
                currentCount--;
            } else if (!this.safes.has(ncKey)) { // Only add unknown cells
                newSentenceCells.add(nc); // Store as [row,col] for Sentence constructor
            }
        }

        const newSentence = new Sentence(Array.from(newSentenceCells), currentCount);

        // Only add if it's a valid sentence (non-empty cells)
        if (newSentence.cells.size > 0) {
            this.knowledge.push(newSentence);
        }

        // 4) mark any additional cells as safe or as mines
        // 5) add any new sentences inferred from existing knowledge
        this.check_knowledge();
        this.extra_inference();
        this.check_knowledge(); // Run again after inference
    }

    _return_neighbour_cells(cell) {
        const [ci, cj] = cell;
        const nearby_cells = new Set();
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                if (Math.abs(ci - r) <= 1 && Math.abs(cj - c) <= 1 && (r !== ci || c !== cj)) {
                    nearby_cells.add([r, c]); // Store as [row,col]
                }
            }
        }
        return nearby_cells;
    }

    // Helper to ensure sentences are valid and simplify knowledge
    check_knowledge() {
        // Iterate over a copy to allow modification of original this.knowledge
        let madeChanges = false;
        const knowledgeCopy = [...this.knowledge]; // Shallow copy of array
        this.knowledge = []; // Reset knowledge, will rebuild with valid sentences

        for (const sentence of knowledgeCopy) {
            // First, remove cells from sentence that are already known safe/mine
            const cellsToRemove = new Set();
            for (const cellKey of sentence.cells) {
                if (this.safes.has(cellKey)) {
                    cellsToRemove.add(cellKey);
                } else if (this.mines.has(cellKey)) {
                    cellsToRemove.add(cellKey);
                    sentence.count--; // Adjust count if a mine was in the sentence
                }
            }
            for (const cellKey of cellsToRemove) {
                sentence.cells.delete(cellKey);
                madeChanges = true;
            }

            // After reduction, check if cells are known mines/safes
            const knownMines = sentence.known_mines();
            const knownSafes = sentence.known_safes();

            if (knownMines) {
                for (const cellKey of knownMines) {
                    this.mark_mine(this._parseCellKey(cellKey));
                    madeChanges = true;
                }
            }
            if (knownSafes) {
                for (const cellKey of knownSafes) {
                    this.mark_safe(this._parseCellKey(cellKey));
                    madeChanges = true;
                }
            }

            // Only keep valid sentences
            if (sentence.cells.size > 0 && sentence.count >= 0 && sentence.count <= sentence.cells.size) {
                 // Check for duplicate sentences to prevent infinite loops from subset rule
                let isDuplicate = false;
                for(const existingSentence of this.knowledge) {
                    if (existingSentence.equals(sentence)) {
                        isDuplicate = true;
                        break;
                    }
                }
                if (!isDuplicate) {
                    this.knowledge.push(sentence);
                }
            }
        }

        // Re-run if changes were made, to propagate new knowledge
        if (madeChanges) {
             this.check_knowledge();
        }
    }

    extra_inference() {
        let madeChanges = false;
        const knowledgeCopy = [...this.knowledge]; // Shallow copy of array
        const newSentencesToAdd = [];

        for (let i = 0; i < knowledgeCopy.length; i++) {
            for (let j = 0; j < knowledgeCopy.length; j++) {
                if (i === j) continue;

                const s1 = knowledgeCopy[i];
                const s2 = knowledgeCopy[j];

                // Rule: If s1 is a subset of s2 (s1 ⊆ s2)
                // then s2 - s1 = s2.count - s1.count
                // The sets are stored as string keys, so need to check subset correctly
                let s1_is_subset_of_s2 = true;
                for (const cellKey of s1.cells) {
                    if (!s2.cells.has(cellKey)) {
                        s1_is_subset_of_s2 = false;
                        break;
                    }
                }

                if (s1_is_subset_of_s2) {
                    const newCells = new Set();
                    for (const cellKey of s2.cells) {
                        if (!s1.cells.has(cellKey)) {
                            newCells.add(this._parseCellKey(cellKey)); // Convert back to [row,col]
                        }
                    }
                    const newCount = s2.count - s1.count;
                    const newSentence = new Sentence(Array.from(newCells), newCount); // Convert Set to Array

                    // Only add if it's a valid and non-empty sentence
                    if (newSentence.cells.size > 0 && newSentence.count >= 0 && newSentence.count <= newSentence.cells.size) {
                         // Check if new sentence already exists to prevent duplicates
                        let exists = false;
                        for(const existingSentence of this.knowledge) {
                            if (existingSentence.equals(newSentence)) {
                                exists = true;
                                break;
                            }
                        }
                        if (!exists) {
                            newSentencesToAdd.push(newSentence);
                            madeChanges = true;
                        }
                    }
                }
            }
        }
        // Add new sentences found
        for(const newSentence of newSentencesToAdd) {
            this.knowledge.push(newSentence);
        }

        // Re-run check_knowledge if any new sentences were inferred
        if (madeChanges) {
            this.check_knowledge();
        }
    }


    make_safe_move() {
        // Iterate through known safe cells
        for (const cellKey of this.safes) {
            if (!this.moves_made.has(cellKey)) {
                return this._parseCellKey(cellKey); // Return as [row,col]
            }
        }
        return null;
    }

    make_random_move() {
        const possibleMoves = [];
        for (let i = 0; i < this.height; i++) {
            for (let j = 0; j < this.width; j++) {
                const cellKey = `${i},${j}`;
                // Must not be already made or a known mine
                if (!this.moves_made.has(cellKey) && !this.mines.has(cellKey)) {
                    possibleMoves.push([i, j]);
                }
            }
        }

        if (possibleMoves.length > 0) {
            const randomIndex = Math.floor(Math.random() * possibleMoves.length);
            return possibleMoves[randomIndex];
        }
        return null; // No valid random moves left
    }
}