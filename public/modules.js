/**
 * CS 186 Curriculum Modules — Step-by-step learning with the chat assistant.
 * Adds a module picker to the chat panel and injects curriculum-aware system prompts.
 * Loads after chat-widget.js.
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // MODULE DEFINITIONS — each module teaches one topic area
  // ═══════════════════════════════════════════════════════════
  var MODULES = [
    {
      id: 'sql',
      title: 'SQL Mastery',
      icon: '1',
      color: '#60a5fa',
      units: [
        'Conceptual Evaluation Order (FROM-WHERE-GROUP BY-HAVING-SELECT-ORDER BY-LIMIT)',
        'Aggregation Rules (AVG, SUM, COUNT, MAX, MIN and the GROUP BY requirement)',
        'WHERE vs HAVING (when to filter before vs after grouping)',
        'Joins (cross, inner, natural, self-joins, LEFT/RIGHT outer joins, ON vs WHERE placement)',
        'Set Operations (UNION vs UNION ALL, INTERSECT, EXCEPT set vs bag semantics)',
        'Subqueries (IN, EXISTS, ALL, ANY, correlated vs uncorrelated)',
        'CTEs and Views (WITH clause, CREATE VIEW)',
        'SQL Pitfalls the traps that appear on every exam'
      ],
      extendedRef: 'Section 1 (1.1-1.8)',
      cheatsheetRef: 'Side 1, top-left: SQL section',
      curriculum: 'You are teaching SQL for CS 186 Midterm 1. Cover these concepts IN ORDER, one at a time. For each concept:\n\n'
        + '1. **Explain the concept** clearly with a simple example\n'
        + '2. **Connect to Extended Cheatsheet**: "On the extended reference, this is in Section 1.X..."\n'
        + '3. **Connect to Handwritten Cheatsheet**: "On your printed cheat sheet (Side 1), look at..."\n'
        + '4. **Mini Quiz**: Give 1-2 short questions to test understanding\n'
        + '5. **Practice Problem**: Create a realistic exam-style problem (like "mark all correct queries")\n'
        + '6. Wait for the student to answer before revealing the solution\n\n'
        + 'KEY CONCEPTS TO EMPHASIZE:\n'
        + '- Evaluation order: FROM-WHERE-GROUP BY-HAVING-SELECT-ORDER BY-LIMIT\n'
        + '- GROUP BY rule: every non-aggregated column in SELECT must be in GROUP BY\n'
        + '- WHERE filters rows BEFORE grouping; HAVING filters groups AFTER\n'
        + '- JOIN + aggregate can duplicate rows causing wrong AVG/SUM (use IN subquery instead)\n'
        + '- LEFT JOIN: filter in ON preserves all left rows; filter in WHERE can eliminate them\n'
        + '- COUNT(*) counts everything including NULLs; COUNT(col) skips NULLs\n'
        + '- UNION = set (deduplicates); UNION ALL = bag (keeps all)\n'
        + '- Self-join for pairs: use t1.id < t2.id for unique unordered pairs\n'
        + '- Find the max patterns: HAVING >= ALL(subquery) or ORDER BY DESC LIMIT 1\n'
        + '- CAST(col AS type) for type conversion, integer/integer = integer in SQL\n'
        + '- Correlated subquery: references outer query, runs once per outer row\n\n'
        + 'UNITS (teach in this order):\n'
        + '1. Conceptual Evaluation Order\n2. Aggregation Rules\n3. WHERE vs HAVING\n'
        + '4. Joins (inner, outer, self)\n5. Set Operations\n6. Subqueries\n7. CTEs and Views\n8. SQL Pitfalls\n\n'
        + 'After all units, give a comprehensive exam-style practice set (4-5 questions mixing all concepts).'
    },
    {
      id: 'disks',
      title: 'Disks & Files',
      icon: '2',
      color: '#fb923c',
      units: [
        'Storage Hierarchy (CPU cache to RAM to SSD to HDD speeds and tradeoffs)',
        'HDD vs SSD (spinning disks, platters, sequential vs random access)',
        'Pages the unit of disk I/O',
        'File Types (heap files vs sorted files structure and tradeoffs)',
        'Slotted Page Layout (footer, slot directory, record placement)',
        'Record Formats (fixed-length vs variable-length, null bitmaps)',
        'Record Size Calculations (the exam-favorite computation)'
      ],
      extendedRef: 'Section 2 (2.1-2.7)',
      cheatsheetRef: 'Side 1, middle: Disks/Files section',
      curriculum: 'You are teaching Disks, Files and Records for CS 186 Midterm 1. Cover IN ORDER:\n\n'
        + '1. **Explain** each concept with concrete examples (actual byte sizes, page structures)\n'
        + '2. **Connect to Extended Cheatsheet**: Reference Section 2.X\n'
        + '3. **Connect to Handwritten Cheatsheet**: On Side 1, look at the Disks/Files area\n'
        + '4. **Mini Quiz** after each concept\n'
        + '5. **Practice Problem**: Create record-size calculations, page-fitting problems\n\n'
        + 'KEY CONCEPTS:\n'
        + '- Page = unit of disk I/O (typically 4KB-64KB). Data must be in RAM before CPU uses it.\n'
        + '- Heap file: unordered pages. Fast insert (append), slow search (scan all). Insert = 2 IO.\n'
        + '- Sorted file: pages in order. Binary search for lookup, but inserts are expensive (shifting).\n'
        + '- Slotted pages: metadata/slot directory at bottom, records grow from top. Supports variable-length.\n'
        + '- Slot directory entries are 2 bytes each (pointer to record start within page).\n'
        + '- Fixed-length records: simple offset arithmetic. Variable-length: field offset pointers in header.\n'
        + '- Null bitmap: 1 bit per field to mark NULLs. Saves space over storing null markers.\n'
        + '- Record size = header + sum of field sizes. CHAR(n)=n bytes, INTEGER=4, FLOAT=8.\n'
        + '- VARCHAR(n) = 0 to n bytes. TEXT = 0+ bytes. SERIAL = 4 bytes when present, 0 when NULL.\n'
        + '- Records per page = floor((page_size - footer) / (record_size + slot_entry_size))\n'
        + '- Packed layout: all slots same size (max record), simple. Unpacked: variable-size, need bitmap.\n'
        + '- Heap file variants: linked-list (1 header page) vs page-directory (dir pages count = ceil(pages/entries_per_dir_page))\n'
        + '- Page directory helps INSERTS (find free space) but NOT searches\n\n'
        + 'The record size calculation unit should include a full worked example with a schema.'
    },
    {
      id: 'io',
      title: 'IO Cost Model',
      icon: '3',
      color: '#fbbf24',
      units: [
        'IO Cost Framework (why we count only disk I/Os, B and R notation)',
        'Heap File Costs (equality search, range search, insert, delete)',
        'Sorted File Costs (binary search, range scan, insert, delete)',
        'Comparison: Heap vs Sorted (when each is better)',
        'Why We Need Indexes (the motivation for B+ trees)'
      ],
      extendedRef: 'Section 3 (3.1-3.4)',
      cheatsheetRef: 'Side 1, bottom: IO Cost Model table',
      curriculum: 'You are teaching IO Cost Analysis for CS 186 Midterm 1. Cover IN ORDER:\n\n'
        + 'KEY CONCEPTS:\n'
        + '- We ONLY count disk I/Os (reads and writes). Ignore CPU cost, sequential vs random, prefetching.\n'
        + '- B = number of pages in file, R = number of records per page\n'
        + '- Must bring data into RAM before operating on it\n\n'
        + 'HEAP FILE COSTS:\n'
        + '- Equality search: avg B/2, worst B (scan until found)\n'
        + '- Range search: B (must scan everything, no ordering)\n'
        + '- Insert: 2 IOs (read last page + write back)\n'
        + '- Delete: (search cost) + 1 IO (write back modified page)\n\n'
        + 'SORTED FILE COSTS:\n'
        + '- Equality search: log2(B) (binary search on pages)\n'
        + '- Range search: log2(B) + (number of matching pages)\n'
        + '- Insert: log2(B) + B to find position + shift everything after + write all\n'
        + '- Delete: similar to insert (maintain sorted order)\n\n'
        + 'KEY INSIGHT: Neither heap nor sorted is great for ALL operations. This motivates indexes.\n'
        + '- Heap: fast writes, slow reads\n'
        + '- Sorted: fast reads, slow writes\n'
        + '- Indexes aim for best of both worlds\n\n'
        + 'Give problems like:\n'
        + '- You have a 500-page heap file. How many IOs for equality search worst case?\n'
        + '- Compare IO costs of inserting into heap vs sorted file with B=1000\n'
        + '- Build up to combined problems with page directories'
    },
    {
      id: 'btree',
      title: 'B+ Trees',
      icon: '4',
      color: '#34d399',
      units: [
        'B+ Tree Structure (interior nodes, leaf nodes, linked list, balanced)',
        'Key Formulas (order d, fanout 2d+1, occupancy d-2d, root 1-2d)',
        'Search Operation (following pointers from root to leaf)',
        'Insert with Splitting (COPY UP for leaves, PUSH UP for inner nodes)',
        'Delete with Redistribution and Merging',
        'Bulk Loading (sort first, fill to fill factor, build bottom-up)',
        'Data Alternatives (Alt 1: records at leaves, Alt 2: key+rid, Alt 3: key+rid list)',
        'Clustered vs Unclustered Indexes (only 1 clustered per table!)',
        'IO Costs with B+ Trees (search, insert, delete for each alternative)',
        'Composite Indexes (prefix rule order of columns matters!)'
      ],
      extendedRef: 'Section 4 (4.1-4.10)',
      cheatsheetRef: 'Side 2, left: B+ Trees section',
      curriculum: 'You are teaching B+ Trees for CS 186 Midterm 1. This is the HIGHEST-WEIGHT topic. Cover IN ORDER:\n\n'
        + 'KEY FORMULAS (student MUST memorize):\n'
        + '- Order d: each non-root node has d to 2d keys. Root has 1 to 2d keys.\n'
        + '- Maximum fanout F = 2d + 1 (NOT 2d this is a common exam trap!)\n'
        + '- Interior: d+1 to 2d+1 pointers. Root: 2 to 2d+1 pointers.\n'
        + '- All leaves at same depth (balanced). Leaves linked (doubly linked list).\n\n'
        + 'INSERT RULES:\n'
        + '- Find correct leaf. If it has space, insert.\n'
        + '- If leaf is full: split into two leaves. COPY UP middle key to parent.\n'
        + '- If inner node is full: split. PUSH UP middle key to parent.\n'
        + '- COPY UP = key stays in leaf AND goes to parent. PUSH UP = key moves OUT of inner node.\n'
        + '- Height ONLY increases when ROOT splits (creating new root).\n\n'
        + 'BULK LOADING:\n'
        + '- Sort data first. Fill leaves to fill factor. Build inner nodes bottom-up.\n'
        + '- Copy up first key of each non-first leaf to parent.\n'
        + '- Much cheaper than inserting one at a time.\n\n'
        + 'ALTERNATIVES:\n'
        + '- Alt 1: actual records at leaves (clustered index). Search cost = tree height.\n'
        + '- Alt 2: (key, recordID) at leaves. Search = height + 1 IO (fetch from heap).\n'
        + '- Alt 3: (key, list of recordIDs). Compact but complex.\n\n'
        + 'CLUSTERED vs UNCLUSTERED:\n'
        + '- Clustered: leaf order matches physical order on disk. ONLY ONE per table.\n'
        + '- Unclustered: pointers jump around disk. Range scans can be WORSE than heap scan.\n\n'
        + 'COMPOSITE INDEXES:\n'
        + '- Index on (A, B) can answer queries on A alone, or A AND B. NOT B alone.\n'
        + '- Prefix rule: can use any prefix of the composite key.\n\n'
        + 'For insert traces, ALWAYS draw the tree step by step. Show which nodes split.'
    },
    {
      id: 'spatial',
      title: 'Spatial Indexes',
      icon: '5',
      color: '#c084fc',
      units: [
        'Why Spatial Indexes (multi-dimensional queries, B+ trees only handle 1D)',
        'KD Trees (alternating split dimensions, search, insert)',
        'Nearest Neighbor Search (backtracking, application to RAG/LLMs)',
        'R-Trees (bounding rectangles, MBRs, overlap is OK)',
        'KD Trees vs R-Trees (comparison and tradeoffs)'
      ],
      extendedRef: 'Section 5 (5.1-5.4)',
      cheatsheetRef: 'Side 2, middle: Spatial Indexes section',
      curriculum: 'You are teaching Spatial and Vector Indexes for CS 186 Midterm 1.\n\n'
        + 'KEY CONCEPTS:\n'
        + '- B+ trees only handle 1D ordered data. Spatial data (2D points, geographic) needs special indexes.\n\n'
        + 'KD TREES:\n'
        + '- Binary tree that alternates splitting dimension at each level.\n'
        + '- Level 0: split on X. Level 1: split on Y. Level 2: split on X again.\n'
        + '- Each node stores a data point and partitions space.\n'
        + '- Search: traverse tree comparing appropriate dimension at each level.\n'
        + '- Insert: search for position, add as new leaf.\n\n'
        + 'NEAREST NEIGHBOR:\n'
        + '- Find candidate by traversing tree, then backtrack checking other subtrees.\n'
        + '- Can prune subtrees whose closest possible point is farther than current best.\n'
        + '- Application: RAG in LLMs (documents to vectors, nearest neighbor finds relevant docs).\n\n'
        + 'R-TREES:\n'
        + '- Like B+ trees but for multi-dimensional data.\n'
        + '- Interior nodes: Minimum Bounding Rectangles (MBRs).\n'
        + '- Leaf nodes: actual objects with bounding boxes.\n'
        + '- Rectangles CAN overlap (unlike KD tree partitions).\n'
        + '- Search: check which MBRs overlap query region, recurse into those.\n'
        + '- Insert: choose subtree whose MBR needs least expansion.\n\n'
        + 'COMPARISON:\n'
        + '- KD: binary, alternating dimensions, exact partitions, good for points\n'
        + '- R-Tree: multi-way, bounding rectangles, overlap OK, good for rectangles/polygons'
    },
    {
      id: 'buffer',
      title: 'Buffer Management',
      icon: '6',
      color: '#f472b6',
      units: [
        'Why Buffer Management (bridge between disk and memory)',
        'Buffer Pool Structure (frames, page ID, dirty bit, pin count)',
        'Pin and Unpin Operations (requesting and releasing pages)',
        'LRU Policy (evict least recently used and its weakness)',
        'MRU Policy (evict most recently used when it helps)',
        'Clock Policy (approximation of LRU with reference bits)',
        'Clock Policy Trace step-by-step walkthrough',
        'Sequential Flooding (why LRU fails on repeated sequential scans)',
        'LRU vs MRU comparison and when each wins'
      ],
      extendedRef: 'Section 6 (6.1-6.6)',
      cheatsheetRef: 'Side 2, right: Buffer Management section',
      curriculum: 'You are teaching Buffer Management for CS 186 Midterm 1.\n\n'
        + 'KEY CONCEPTS:\n'
        + '- Buffer pool: array of frames in memory. Each frame holds one page.\n'
        + '- Frame metadata: page ID, dirty bit (modified since read?), pin count (number of current users).\n'
        + '- Pin count > 0 means page CANNOT be evicted.\n\n'
        + 'PIN/UNPIN:\n'
        + '- Pin (request page): if in buffer increment pin count; if not read from disk, pin count = 1.\n'
        + '- If buffer full must evict. Choose victim by replacement policy. Write dirty pages first.\n'
        + '- Unpin (release): decrement pin count. Optionally set dirty bit.\n\n'
        + 'REPLACEMENT POLICIES:\n'
        + '- LRU: evict page used LEAST recently. Good for temporal locality. BAD for sequential scans.\n'
        + '- MRU: evict page used MOST recently. Good for sequential scans (just finished with that page).\n'
        + '- Clock: approximation of LRU. Circular buffer with clock hand.\n'
        + '  - Each frame has ref bit. On access: set ref = 1.\n'
        + '  - On eviction: sweep clock hand. If ref = 1, set to 0 and advance. If ref = 0, evict.\n'
        + '  - PostgreSQL uses counter (0-5) instead of single bit.\n\n'
        + 'SEQUENTIAL FLOODING:\n'
        + '- Repeated sequential scan of file larger than buffer.\n'
        + '- LRU gets 0 hits (always evicts the page needed next!).\n'
        + '- MRU keeps early pages, gets hits when scan wraps around.\n\n'
        + 'KEY TRUE/FALSE (appear on EVERY exam):\n'
        + '- Pin count = number of current users, NOT total accesses.\n'
        + '- Dirty bit set by REQUESTOR (file/index code), not buffer manager.\n'
        + '- Frame size = page size.\n'
        + '- If buffer >= unique pages, ALL policies equivalent (no eviction needed).\n'
        + '- Neither MRU nor LRU is always better depends on access pattern.\n\n'
        + 'TEACHING METHOD FOR TRACES:\n'
        + 'Draw a table: Access | Buffer State | Hit/Miss | Evicted | (ref bits for Clock)\n'
        + 'Walk through EVERY access step by step. Make the student do at least one trace themselves.'
    }
  ];

  // ═══════════════════════════════════════════════════════════
  // SAFE DOM HELPERS
  // ═══════════════════════════════════════════════════════════

  function ce(tag, styles, text) {
    var e = document.createElement(tag);
    if (styles) e.style.cssText = styles;
    if (text) e.textContent = text;
    return e;
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE PICKER UI
  // ═══════════════════════════════════════════════════════════

  var activeModule = null;

  function init() {
    var panel = document.getElementById('chat-panel');
    var messagesDiv = document.getElementById('chat-messages');
    var header = document.getElementById('chat-header');
    if (!panel || !messagesDiv || !header) {
      setTimeout(init, 200);
      return;
    }

    // Add module picker button to header
    var moduleBtn = document.createElement('button');
    moduleBtn.id = 'module-btn';
    moduleBtn.title = 'Learning Modules';
    moduleBtn.style.cssText = 'background:rgba(74,144,217,0.15);border:1px solid #4A90D9;font-size:0.7em;cursor:pointer;padding:3px 8px;color:#4A90D9;font-weight:700;border-radius:6px;margin-left:4px;white-space:nowrap;';
    moduleBtn.textContent = 'Modules';
    var closeBtn = header.querySelector('#chat-close');
    header.insertBefore(moduleBtn, closeBtn);

    // Create module picker overlay
    var overlay = ce('div', 'display:none;position:absolute;inset:0;background:#12141fF0;z-index:15;overflow-y:auto;padding:16px;flex-direction:column;gap:12px;');
    overlay.id = 'module-overlay';

    // Title bar
    var overlayHeader = ce('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;');
    var titleSpan = ce('span', 'color:#4A90D9;font-weight:700;font-size:1.05em;', 'Learning Modules');
    overlayHeader.appendChild(titleSpan);
    var backBtn = ce('button', 'background:none;border:none;color:#8a8fa8;cursor:pointer;font-size:1.4em;padding:4px;', '\u00d7');
    backBtn.addEventListener('click', function () { overlay.style.display = 'none'; });
    overlayHeader.appendChild(backBtn);
    overlay.appendChild(overlayHeader);

    // Description
    var desc = ce('p', 'color:#8a8fa8;font-size:0.8em;line-height:1.5;margin-bottom:12px;',
      'Pick a module to learn step-by-step. Claude will teach each concept, connect it to your cheat sheets, quiz you, and create practice problems.');
    overlay.appendChild(desc);

    // Free chat option
    var freeChat = ce('div', 'background:#1a1d2e;border:1px solid #2a2d3e;border-radius:10px;padding:12px;cursor:pointer;transition:0.2s;');
    var fcTitle = ce('div', 'font-weight:600;color:#e0e0e8;font-size:0.9em;', 'Free Chat Mode');
    var fcDesc = ce('div', 'color:#8a8fa8;font-size:0.78em;margin-top:2px;', 'Ask anything about Midterm 1 topics');
    freeChat.appendChild(fcTitle);
    freeChat.appendChild(fcDesc);
    freeChat.addEventListener('mouseenter', function () { this.style.borderColor = '#4A90D9'; });
    freeChat.addEventListener('mouseleave', function () { this.style.borderColor = activeModule === null ? '#4A90D9' : '#2a2d3e'; });
    if (activeModule === null) freeChat.style.borderColor = '#4A90D9';
    freeChat.addEventListener('click', function () {
      activateModule(null, messagesDiv);
      overlay.style.display = 'none';
    });
    overlay.appendChild(freeChat);

    // Module cards
    MODULES.forEach(function (mod) {
      var card = ce('div', 'background:#1a1d2e;border:1px solid #2a2d3e;border-radius:10px;padding:12px;cursor:pointer;transition:0.2s;');
      card.dataset.moduleId = mod.id;

      // Header row
      var headerRow = ce('div', 'display:flex;align-items:center;gap:8px;margin-bottom:4px;');
      var badge = ce('span', 'background:' + mod.color + '22;color:' + mod.color + ';width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85em;flex-shrink:0;', mod.icon);
      headerRow.appendChild(badge);
      var titleEl = ce('span', 'font-weight:600;color:#e0e0e8;font-size:0.9em;', mod.title);
      headerRow.appendChild(titleEl);
      var countEl = ce('span', 'color:#8a8fa8;font-size:0.7em;margin-left:auto;', mod.units.length + ' units');
      headerRow.appendChild(countEl);
      card.appendChild(headerRow);

      // Unit preview
      var preview = ce('div', 'color:#8a8fa8;font-size:0.75em;line-height:1.4;margin-top:4px;');
      var previewUnits = mod.units.slice(0, 3);
      previewUnits.forEach(function (u) {
        var line = ce('div', '', '\u2022 ' + u.split('(')[0].trim());
        preview.appendChild(line);
      });
      if (mod.units.length > 3) {
        var more = ce('div', '', '\u2022 ... +' + (mod.units.length - 3) + ' more');
        preview.appendChild(more);
      }
      card.appendChild(preview);

      card.addEventListener('mouseenter', function () { this.style.borderColor = mod.color; });
      card.addEventListener('mouseleave', function () { this.style.borderColor = activeModule === mod.id ? mod.color : '#2a2d3e'; });
      card.addEventListener('click', function () {
        activateModule(mod.id, messagesDiv);
        overlay.style.display = 'none';
      });
      overlay.appendChild(card);
    });

    panel.appendChild(overlay);

    // Module button toggles overlay
    moduleBtn.addEventListener('click', function () {
      var isVisible = overlay.style.display !== 'none';
      overlay.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        // Update active highlights
        overlay.querySelectorAll('[data-module-id]').forEach(function (c) {
          c.style.borderColor = c.dataset.moduleId === activeModule ? getModuleColor(c.dataset.moduleId) : '#2a2d3e';
        });
        freeChat.style.borderColor = activeModule === null ? '#4A90D9' : '#2a2d3e';
      }
    });

    // Add module status bar (below header)
    var statusBar = ce('div', 'display:none;padding:6px 16px;background:#1e2133;border-bottom:1px solid #2a2d3e;font-size:0.78em;color:#8a8fa8;flex-shrink:0;');
    statusBar.id = 'module-status';
    header.insertAdjacentElement('afterend', statusBar);
  }

  function getModuleColor(id) {
    for (var i = 0; i < MODULES.length; i++) {
      if (MODULES[i].id === id) return MODULES[i].color;
    }
    return '#4A90D9';
  }

  function getModule(id) {
    for (var i = 0; i < MODULES.length; i++) {
      if (MODULES[i].id === id) return MODULES[i];
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE ACTIVATION
  // ═══════════════════════════════════════════════════════════

  function activateModule(moduleId, messagesDiv) {
    activeModule = moduleId;

    var statusBar = document.getElementById('module-status');
    var headerTitle = document.querySelector('#chat-header > span:first-child');

    if (moduleId === null) {
      // Free chat mode
      statusBar.style.display = 'none';
      if (headerTitle) headerTitle.textContent = 'CS 186 Study Assistant';
      window._cs186ActiveModulePrompt = null;

      var sysMsg = ce('div', '', 'Switched to free chat mode. Ask me anything!');
      sysMsg.className = 'chat-msg system';
      messagesDiv.appendChild(sysMsg);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      return;
    }

    var mod = getModule(moduleId);
    if (!mod) return;

    // Update status bar
    statusBar.style.display = 'block';
    while (statusBar.firstChild) statusBar.removeChild(statusBar.firstChild);
    var modName = ce('span', 'color:' + mod.color + ';font-weight:600;', mod.title);
    statusBar.appendChild(modName);
    statusBar.appendChild(document.createTextNode(' \u2022 ' + mod.units.length + ' units \u2022 Ref: ' + mod.extendedRef + ' '));
    var exitBtn = ce('button', 'float:right;background:none;border:none;color:#f87171;cursor:pointer;font-size:0.9em;', '\u00d7 Exit');
    exitBtn.addEventListener('click', function () { activateModule(null, messagesDiv); });
    statusBar.appendChild(exitBtn);

    if (headerTitle) headerTitle.textContent = 'Module: ' + mod.title;

    // Build system prompt for this module
    var modulePrompt = 'You are a CS 186 Midterm 1 TUTOR running a structured learning module.\n\n'
      + '=== MODULE: ' + mod.title.toUpperCase() + ' ===\n'
      + 'Extended Cheatsheet Reference: ' + mod.extendedRef + '\n'
      + 'Handwritten Cheatsheet Reference: ' + mod.cheatsheetRef + '\n\n'
      + '=== TEACHING INSTRUCTIONS ===\n'
      + mod.curriculum + '\n\n'
      + '=== UNITS ===\n'
      + mod.units.map(function (u, i) { return (i + 1) + '. ' + u; }).join('\n') + '\n\n'
      + '=== INTERACTION RULES ===\n'
      + '- When student says "start", begin with Unit 1.\n'
      + '- When student says "unit N" or "skip to N", jump to that unit.\n'
      + '- When student says "next", move to the next unit.\n'
      + '- When student says "quiz me", give a practice problem on the current topic.\n'
      + '- When student says "explain more" or "deeper", provide more detail and examples.\n'
      + '- When student says "another problem" or "more practice", create a new different problem.\n'
      + '- When student says "cheatsheet", explain where to find the current concept on both cheatsheets.\n'
      + '- When student says "summary", give a concise summary of everything covered so far.\n'
      + '- After each unit, always end with: "Ready for the next unit? Say next to continue, or quiz me for more practice."\n\n'
      + '=== FORMATTING ===\n'
      + '- Use **bold** for key terms and formulas.\n'
      + '- Use `code` for SQL syntax.\n'
      + '- For B+ tree diagrams, use monospace text to draw trees.\n'
      + '- For buffer traces, use tables with columns: Access | Buffer | Hit/Miss | Evicted.\n'
      + '- Be concise but thorough. Each unit response should be 200-400 words unless the student asks for more.\n'
      + '- ALWAYS include a mini quiz or practice problem at the end of each unit.';

    window._cs186ActiveModulePrompt = modulePrompt;

    // Clear messages and show intro
    while (messagesDiv.firstChild) messagesDiv.removeChild(messagesDiv.firstChild);

    var intro = ce('div', '');
    intro.className = 'chat-msg system';
    var introText = 'Module: ' + mod.title + ' (' + mod.units.length + ' units)\n\nUnits:\n';
    introText += mod.units.map(function (u, i) { return (i + 1) + '. ' + u.split('(')[0].trim(); }).join('\n');
    introText += '\n\nType "start" to begin, or jump to any unit (e.g. "unit 3").\nSay "quiz me" anytime for practice, "deeper" for more detail, or "another problem" for extra practice.';
    intro.textContent = introText;
    messagesDiv.appendChild(intro);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // ═══════════════════════════════════════════════════════════
  // HOOK INTO CHAT WIDGET — intercept API calls to inject module prompt
  // ═══════════════════════════════════════════════════════════

  function hookChatWidget() {
    var origFetch = window.fetch;
    window.fetch = function (url, opts) {
      if (window._cs186ActiveModulePrompt && opts && opts.body) {
        try {
          var body = JSON.parse(opts.body);

          // Direct Anthropic API call: override system prompt
          if (body.system !== undefined && body.messages) {
            body.system = window._cs186ActiveModulePrompt;
            opts = Object.assign({}, opts, { body: JSON.stringify(body) });
          }

          // Proxy call (no system field): prepend module context as messages
          if (body.messages && body.system === undefined) {
            var hasContext = body.messages.length > 0
              && typeof body.messages[0].content === 'string'
              && body.messages[0].content.indexOf('[MODULE CONTEXT]') === 0;
            if (!hasContext) {
              var newMessages = [
                { role: 'user', content: '[MODULE CONTEXT - FOLLOW THESE INSTRUCTIONS]\n' + window._cs186ActiveModulePrompt },
                { role: 'assistant', content: 'Understood. I am ready to teach this module step by step. The student can say "start" to begin.' }
              ].concat(body.messages);
              body.messages = newMessages;
              opts = Object.assign({}, opts, { body: JSON.stringify(body) });
            }
          }
        } catch (e) {
          // Not a JSON body or not our call
        }
      }
      return origFetch.call(this, url, opts);
    };
  }

  // ═══════════════════════════════════════════════════════════
  // INIT CSS + BOOT
  // ═══════════════════════════════════════════════════════════

  var css = document.createElement('style');
  css.textContent = '#module-overlay{scrollbar-width:thin;scrollbar-color:#2a2d3e transparent}'
    + '#module-overlay::-webkit-scrollbar{width:6px}'
    + '#module-overlay::-webkit-scrollbar-thumb{background:#2a2d3e;border-radius:3px}';
  document.head.appendChild(css);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); hookChatWidget(); });
  } else {
    init();
    hookChatWidget();
  }
})();
