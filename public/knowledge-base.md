# CS 186 Midterm 1 Knowledge Base — Spring 2026
# UC Berkeley Database Systems

## META: Course Structure
- Midterm 1: Thursday 2/26, 8-10 PM
- Covers Lectures 1-8 (1/21 - 2/18)
- NOT on midterm: Sorting/Hashing (Lecture 9), Relational Algebra, Join Algorithms, Query Optimization
- Allowed: one 8.5x11 double-sided handwritten cheat sheet
- Instructor: Alvin (Lectures 1-7), Natasha (Lecture 8+)
- Past exams available: Fall 2017, Spring 2018, Fall 2018

## META: Study Materials Available
- Printable cheat sheet (cheatsheet.html): 2-page reference optimized for 8.5x11 double-sided printing — THIS is what can be used in the exam
- Extended reference (extended-cheatsheet.html): Deep dive into every topic with worked examples — NOT for exam use, for learning only
- Flashcards (index.html): 50 concept cards + 40 practice problem cards with spaced repetition
- Study guide (study-guide.html): Comprehensive written guide covering all topics
- Final Review Test (final-review.html): 25 exam-style questions with toggle solutions, organized by topic — from the Spring 2026 Review Session
- Exam Day Cheat Sheet (exam-cheatsheet.html): Ultra-condensed 2-column reference — guide for what to handwrite on the allowed sheet

---

# TOPIC 1: SQL

## 1.1 Conceptual Evaluation Order (CRITICAL)
```
FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
```
- WHERE filters rows BEFORE grouping; cannot use aggregates
- HAVING filters groups AFTER aggregation; CAN use aggregates
- SELECT aliases cannot be used in WHERE (WHERE runs before SELECT)
- ORDER BY CAN reference SELECT aliases (runs after SELECT)
- LIMIT without ORDER BY gives non-deterministic results

## 1.2 SELECT Basics
- `SELECT col1, col2 FROM T WHERE cond`
- `DISTINCT` removes duplicate rows
- `ORDER BY col [ASC|DESC]` — default ASC
- `LIMIT n` — only deterministic WITH ORDER BY
- Expressions: `SELECT price * 1.1 AS tax_price`

## 1.3 Aggregates
- `COUNT(*)` counts ALL rows including NULLs
- `COUNT(col)` counts non-NULL values only
- `COUNT(DISTINCT col)` counts distinct non-NULL values
- `SUM(col)`, `AVG(col)`, `MIN(col)`, `MAX(col)` all ignore NULLs

## 1.4 GROUP BY Rules
**CRITICAL RULE**: Every non-aggregated column in SELECT MUST appear in GROUP BY.
- WRONG: `SELECT name, MAX(gpa) FROM Students`
- RIGHT: `SELECT dept, MAX(gpa) FROM Students GROUP BY dept`
- No GROUP BY needed if no aggregates at all
- HAVING without GROUP BY treats entire table as one group

## 1.5 Joins
| Type | Result |
|------|--------|
| Cross Join | Cartesian product (m × n rows) |
| Inner Join ON | Only matching rows from both tables |
| Natural Join | Auto-matches ALL same-name columns (dangerous!) |
| LEFT OUTER JOIN | ALL left rows + NULLs for non-matches |
| RIGHT OUTER JOIN | ALL right rows + NULLs for non-matches |
| Self Join | Table joined with itself (use aliases) |

**LEFT JOIN trap**: If left row has no match, right cols are NULL. Use `IS NULL` to find non-matches.

## 1.6 Set Operations
| Operation | Duplicates | Notes |
|-----------|-----------|-------|
| UNION | Removed | Set semantics |
| UNION ALL | Kept | Bag semantics, faster |
| INTERSECT | Removed | Rows in BOTH results |
| EXCEPT | Removed | Rows in first but NOT second |

Both queries must have same number of columns with compatible types.

## 1.7 Subqueries
- **IN**: `WHERE col IN (SELECT ...)`
- **EXISTS**: `WHERE EXISTS (SELECT 1 FROM ... WHERE ...)` — true if subquery returns ≥1 row
- **NOT EXISTS**: true when subquery returns 0 rows
- **ALL**: `WHERE col > ALL (SELECT ...)` — true if greater than EVERY value
- **ANY**: `WHERE col > ANY (SELECT ...)` — true if greater than at least ONE

**Correlated vs Uncorrelated**:
- Uncorrelated: inner query runs once independently
- Correlated: inner query references outer query column → re-runs per outer row (slower)

## 1.8 CTEs and Views
- CTE: `WITH name AS (SELECT ...) SELECT ... FROM name` — temporary, query-scoped
- View: `CREATE VIEW name AS SELECT ...` — stored virtual table, query re-runs each use
- Views don't store data

## 1.9 SQL Pitfalls (COMMONLY TESTED)
- **Integer division**: `5/2 = 2` in SQL. Fix: `CAST(x AS FLOAT)` or `x * 1.0`
- **NULL comparisons**: `NULL = NULL` is UNKNOWN, not TRUE. Use `IS NULL`
- **NOT IN with NULLs**: If subquery returns ANY NULL, entire NOT IN is UNKNOWN → returns NO results. Use NOT EXISTS instead.
- **COUNT(DISTINCT col) ≠ COUNT(col)**
- **DISTINCT + ORDER BY**: ORDER BY cols must be in SELECT when DISTINCT is used
- **WHERE with aggregates**: NEVER valid. `WHERE COUNT(*) > 5` is a syntax error.
- **Postgres CAST syntax**: `CAST(col AS TYPE)` not `FLOAT(col)` or `(FLOAT)col`

---

# TOPIC 2: Disks, Files & Records

## 2.1 Storage Hierarchy
CPU Cache → RAM → SSD → HDD → Tape/Cloud (fastest to slowest, smallest to largest)
- All data must be in RAM before CPU can process it
- DBMS manages data between RAM and disk

## 2.2 HDD vs SSD
| | HDD | SSD |
|---|-----|-----|
| Mechanism | Spinning platters, moving arm | Flash memory, no moving parts |
| Random I/O | Slow (seek + rotation, 5-15ms) | Fast |
| Sequential | Good | Good |
| Cost/GB | Cheap | Expensive |

HDD performance: seek time (move arm to track) + rotational latency (wait for sector) + transfer time

## 2.3 Pages
- A page (block) = fundamental unit of disk I/O (typically 4KB-8KB)
- Always read/write FULL pages — cannot read half a page
- Even if you need one record, must read the entire page

## 2.4 File Types
**Heap File**: Unordered collection of pages
- Fast inserts (append): 2 IOs
- Slow equality search: B/2 avg, B worst
- Implementation: linked list (header → free/full page lists) or page directory (entries: pageID + free space)

**Sorted File**: Pages maintained in sorted order by key
- Fast equality search: log₂(B) via binary search
- Expensive inserts/deletes: must shift records to maintain order

## 2.5 Slotted Page Layout
- Page header: number of records, free space pointer, slot directory
- Records grow from TOP of page downward
- Slot directory grows from BOTTOM upward
- Each slot entry = (offset, length) pointing to a record
- Record ID = (page_id, slot_number) — stable even if record moves within page
- Supports variable-length records and compaction

## 2.6 Record Formats
**Fixed-length**: All fields fixed size. Field i at offset = sum of sizes of fields 0..i-1.
**Variable-length**: Header with pointers/offsets to each field's data.
**Null bitmap**: 1 bit per field. Set bit = field is NULL (saves space).

## 2.7 Record Size Calculations (EXAM FAVORITE)
- INTEGER = 4 bytes
- FLOAT = 4 bytes
- CHAR(n) = ALWAYS n bytes (fixed!)
- VARCHAR(n) = 0 to n bytes (variable!)
- Record header = typically 8 bytes (for variable-length with offset pointers)

**Min size** = header + fixed fields + VARCHAR at 0 bytes
**Max size** = header + fixed fields + VARCHAR at max bytes

**Records per page** (packed, with bitmap):
Find largest n such that: `n * record_size + ceil(n/8) ≤ page_size - page_header`

**Records per page** (unpacked, with bitmap):
Find largest n such that: `n * record_size + ceil(n/8) ≤ page_size`
The bitmap allows holes (deleted records leave gaps).

---

# TOPIC 3: IO Cost Model

## 3.1 Assumptions
- **B** = number of data pages in the file
- **R** = number of records per page
- Only count disk I/Os (page reads + page writes)
- Ignore CPU cost, sequential vs random, prefetching
- Every read or write of a page = 1 IO

## 3.2 Complete IO Cost Table
| Operation | Heap File | Sorted File |
|-----------|-----------|-------------|
| Scan all records | B | B |
| Equality search | B/2 avg, B worst | log₂(B) |
| Range search | B (full scan) | log₂(B) + matching pages |
| Insert | 2 (read last + write) | log₂(B) + B + B (find + shift reads + writes) |
| Delete | search + 1 write | log₂(B) + B + B |

## 3.3 Understanding Each Cost
- Heap insert = 2: read last page (1 IO) + write it back with new record (1 IO)
- Heap equality = B/2: linear scan, on average record is halfway through
- Sorted equality = log₂(B): binary search, each step halves search space
- Sorted insert = VERY expensive: find position + shift all subsequent records

## 3.4 Why Indexes?
Neither heap (slow search) nor sorted (slow insert/delete) is great for everything. Indexes aim for fast search with reasonable insert/delete costs.

---

# TOPIC 4: B+ Trees

## 4.1 Structure
- **Order d**: each node has d to 2d keys (root: 1 to 2d)
- **Interior nodes**: keys + child pointers (fanout = pointers per node)
- **Leaf nodes**: keys + record pointers, linked as doubly-linked list
- All leaves at SAME depth (balanced)

## 4.2 Key Formulas
- Max keys/node = 2d
- Min keys/node = d (root: 1)
- Max fanout (interior) = 2d + 1
- Min fanout (interior) = d + 1 (root: 2)
- Max leaf entries = 2d
- Max entries height-h tree = (2d+1)^(h-1) × 2d
- Min entries height-h tree = 2 × (d+1)^(h-2) × d (h ≥ 2)

## 4.3 Search
Start at root. At each interior node: compare search key with node's keys. Follow correct child pointer down. At leaf: scan for key.
Cost = h IOs (h = height), typically 2-3 for real databases.

## 4.4 Insert Algorithm (CRITICAL — MOST TESTED TOPIC)
1. Search to find correct leaf
2. Insert key into leaf
3. If leaf overflows (> 2d entries):
   - **Leaf split**: split into two leaves. **COPY UP** middle key to parent.
   - Key STAYS in leaf (needed to find the record).
4. If parent overflows:
   - **Interior split**: split node. **PUSH UP** middle key to parent.
   - Key REMOVED from node (only routes searches).

**THE CRITICAL DISTINCTION**: Leaf = COPY UP (key stays). Interior = PUSH UP (key removed).

## 4.5 Delete Algorithm
1. Find key in leaf, remove it
2. If leaf underfull (< d entries):
   - Try **redistribute** from sibling (borrow entry) if sibling has > d entries
   - If can't redistribute → **merge** with sibling + pull down parent key
3. May cascade up if parent becomes underfull

## 4.6 Bulk Loading
1. Sort all records by key
2. Fill leaf pages to fill factor (e.g., 2/3 full, 3/4 full)
3. Build parent nodes bottom-up

**Fill factor f**: entries per leaf = floor(2d × f)
**Number of leaf pages** = ceil(total_records / entries_per_leaf)
Much faster than inserting one at a time!

## 4.7 Data Alternatives
| Alt | Leaf Stores | Notes |
|-----|-------------|-------|
| 1 | Actual records | Index IS the data file. Must be clustered. |
| 2 | (key, recordID) | Separate data file. Can be clustered or not. |
| 3 | (key, list of recordIDs) | Compact for duplicates. Can be clustered or not. |

## 4.8 Clustered vs Unclustered
**Clustered**: leaf order = physical record order on disk. Sequential reads for range queries.
**Unclustered**: leaf order ≠ physical order. Random IOs per record in range query!

**Only ONE clustered index per table** (data sorted one way only).

## 4.9 B+ Tree IO Costs (Alt 2)
| Operation | Clustered | Unclustered |
|-----------|-----------|-------------|
| Equality | height + 1 | height + 1 |
| Range (k leaf pages, m records) | height + k + k (data pages) | height + k + up to m (1 IO per record!) |
| Insert | height + 1 read + 1 write + possible splits | Same |

Height typically 2-3. Root often cached → -1 IO.

## 4.10 Composite Index Prefix Rule
Index on (A, B, C) sorts by A first, then B, then C.
- CAN use for: WHERE A=x | WHERE A=x AND B=y | WHERE A=x AND B=y AND C=z
- CANNOT use for: WHERE B=y | WHERE C=z | WHERE B=y AND C=z
- PARTIAL: WHERE A=x AND C=z → only uses A part
Must constrain the LEFTMOST PREFIX of the composite key.

---

# TOPIC 5: Spatial Indexes

## 5.1 KD Trees
- Binary tree alternating split dimension at each level
- Level 0: split on X. Level 1: split on Y. Level 2: split on X again...
- For K dimensions: cycle through 0, 1, ..., K-1
- Each node stores a data point and partitions space
- Space partitioned into NON-OVERLAPPING regions

**Search**: At each node, compare query's dimension-value with node's split value. Go left if less, right if greater.
**Insert**: Search to find position, add node.
**Range query**: Check if query range intersects node's region. If yes, recurse into both children. If no, prune.

## 5.2 KD Tree Nearest Neighbor
1. Traverse down to find candidate nearest point
2. Backtrack: at each ancestor, check if other subtree could contain closer point
3. If distance to split plane < current best distance, search other subtree
4. Update best if closer point found

**Application**: RAG in LLMs — documents as vectors, find nearest neighbors for relevant context.

## 5.3 R-Trees
- Like B+ trees for multi-dimensional data
- Interior nodes: MBRs (Minimum Bounding Rectangles) enclosing all data in subtree
- Leaf nodes: actual spatial objects with bounding boxes
- Balanced (all leaves at same depth), like B+ trees
- **Key difference from KD**: R-tree rectangles CAN OVERLAP

**Search**: Find all MBRs overlapping query region, recurse into ALL matching children (may follow multiple paths).
**Insert**: Choose subtree whose MBR needs LEAST EXPANSION (smallest area increase).

## 5.4 KD vs R-Tree Comparison
| Feature | KD Tree | R-Tree |
|---------|---------|--------|
| Structure | Binary tree | Multi-way balanced (like B+) |
| Regions | Non-overlapping | Can overlap |
| Splits | Alternating dimensions | MBR-based |
| Balanced? | Not guaranteed | Yes (like B+) |
| Best for | Point queries, NN | Range/region queries |
| Search paths | Single path | May follow multiple paths |
| Disk-friendly? | Not particularly | Yes (node = page) |

---

# TOPIC 6: Buffer Management

## 6.1 Buffer Pool Structure
- Array of frames in RAM. Each frame holds one page.
- Each frame tracks: Page ID, Dirty Bit, Pin Count
- Allocated at DBMS startup

## 6.2 Page Operations
| Operation | Action |
|-----------|--------|
| Pin (request) | If in buffer: pin++. If not: read from disk, pin=1. If full: evict (pin=0 only) |
| Unpin (release) | pin--. Optionally set dirty=true if modified. |
| Eviction | Pin count MUST be 0. If dirty: write to disk first. Then replace. |

**CRITICAL RULES**:
- Pin count > 0 = page CANNOT be evicted
- Dirty bit set by REQUESTOR on unpin, NOT by buffer manager
- Pin count = number of CURRENT users, not total accesses

## 6.3 LRU (Least Recently Used)
- Evict page whose last access is oldest
- Good general-purpose policy
- **PROBLEM: Sequential flooding** — scanning file > buffer size evicts useful pages, 0 hits

## 6.4 MRU (Most Recently Used)
- Evict page most recently accessed
- Better for sequential scans — evicts just-finished page, keeps useful cached pages
- First N-1 pages stay cached during sequential scan

## 6.5 Clock Policy
- Circular buffer + clock hand + reference counter per frame
- On access: set ref counter (Postgres: increment up to max 5)
- On eviction:
  1. Look at frame under clock hand
  2. If pin > 0: skip, advance hand
  3. If ref > 0: decrement ref, advance hand (second chance)
  4. If ref = 0: EVICT this page
- Hand starts where it stopped last time (doesn't reset)
- Approximates LRU but cheaper to maintain
- Clock with max ref=1 approximates LRU

## 6.6 Sequential Flooding Detail
- Buffer has N frames, scanning file with > N pages
- LRU: each new page evicts oldest → buffer churns → 0 hits
- MRU: each new page evicts most recent → earlier pages stay → better for repeated scans

## 6.7 Key True/False for Exams
- Pin count = number of current users, NOT total accesses → TRUE
- Buffer manager sets dirty bit → FALSE (requestor does)
- Page with pin count 0 and dirty bit can be evicted → TRUE (write to disk first)
- MRU always better than LRU → FALSE (MRU better for sequential, LRU better general)
- Clock with max ref=1 approximates LRU → TRUE
- Sequential flooding happens with MRU → FALSE (happens with LRU)
- Each frame is the size of a disk page → TRUE
- Sequential scan has same hit rate with MRU and LRU when file < buffer → TRUE

---

# TOPIC 7: Past Exam Questions & Solutions

## Fall 2017 Midterm 1

### SQL (Deck table: suit, val, score)
**Q1**: Valid SQL for `score/2` as float? → Answer: C. `SELECT CAST(score AS FLOAT)/2 FROM Deck`. Postgres uses CAST(attr AS TYPE) syntax.

**Q2**: Create view Hand with distinct 2-card draws (order doesn't matter). → Answer: B and C. Use lexicographic ordering: `WHERE (draw1.suit > draw2.suit OR (draw1.suit = draw2.suit AND draw1.val > draw2.val))` or the < version.

**Q3**: Total score of two-card hand from Hand view. → Answer: D. `SELECT suit1, val1, suit2, val2, score1 + score2 AS score FROM Hand GROUP BY suit1, val1, suit2, val2, score1, score2`. Since hands are uniquely identified by their cards, GROUP BY on all columns is equivalent to no GROUP BY.

### Heap Files (8MB heap, 64KB pages)
- Pages = 8000/64 = 125 pages
- Page directory with 24 entries/page: ceil(125/24) = 6 directory pages (or 5 additional)
- Insert worst case with page directory: scan directory (B IOs) + read page (1) + write page (1) + write directory (1) = B + 3 IOs
- Update record by primary key in heap: scan all pages to find + write = A + 1 IOs (page directory not involved in search)
- Update in sorted file: log₂(A) + 2A IOs (find + shift all pages)

### B+ Trees (order 2, tree: root [8,13,20,25], leaves [2,7], [8,11,12], [13,16], [21,22], [25,28,31,32])
- Insert 27: leaf [25,28,31,32] overflows → split to [25,27] and [28,31,32], copy up 28. Root [8,13,20,25,28] overflows → split to [8,13] and [25,28], push up 20. **2 nodes split**.
- Insert 26 (after 27): goes to leaf [25,27], becomes [25,26,27] which has 3 entries ≤ 2d=4, so **0 splits**.
- After inserting 26, 27, 34-100: leftmost leaf unchanged at [2,7] (all inserts go right).
- DataBox class was used for B+ tree keys in homework.

### B+ Tree Properties
- Max fanout F = 2d + 1
- Max entries height-5 tree = F^5
- Min IOs to check if key exists in B+ tree with 10^9 records = 1 + log_F(10^9/F)

## Spring 2018 Midterm 1

### SQL/Relational Algebra (28pts)
Covered SQL queries, joins, views, and relational algebra expressions.

### File Organization (6.5pts)
Record size calculations, page calculations.

### Indices (20.5pts)
B+ tree operations, clustered vs unclustered costs.

### Buffers/Sorting/Hashing (20pts)
Buffer management traces, replacement policies.

## Fall 2018 Midterm 1

### Sorting/Hashing (18pts)
- Sorting: Pass 0 uses all B buffers; subsequent passes use B-1 input + 1 output → Answer: A, D true
- N=1000, B=11: passes = 1 + ceil(log₁₀(1000/11)) = 3 passes
- Projection optimization: read 1000 pages, write 100 pages (10x smaller), read 100, write 100 = 1300 IOs
- Hashing IOs: 3 × 2000 = 6000 (each pass reads+writes all pages, 3 passes)
- Max file for hashing without recursive partitioning (B=10): 9 × 10 = 90 pages
- Min file for recursive partitioning (B=10): 11 pages (worst case all into 1 partition > B)
- External sorting IO patterns: Pass 0 reads=S, writes=S. Pass 1+ reads=R (random across runs), writes=S
- External hashing IO patterns: Pass 1 reads=S, writes=R. Pass 2 reads=S, writes=S

### Disks, Buffers, Files (16pts)
**Products table**: id INTEGER PK, stock INTEGER NOT NULL, price INTEGER NOT NULL, name VARCHAR(10) NOT NULL, category CHAR(6) NOT NULL, serial_number CHAR(20) nullable.
- Header = 8 bytes. Fixed: 3×4=12 (integers) + 6 (CHAR6) + 20 (CHAR20) = 38. Variable: VARCHAR(10) = 0-10.
- Min = 8+12+0+6+20 = 46, but with null bitmap need to account for nullable serial_number
- Possible sizes with 8-byte header: 26-36 and 46-56 → Answers: B(27), E(48), F(55)
- Fragmentation: TRUE — deleting records with non-NULL serial_number then inserting with NULL creates smaller record that doesn't fill the gap.
- Packed page (1KB, 64-byte records): 1024/64 = 16 records
- Unpacked page (1KB, 64-byte records, bitmap): 15 records (2-byte bitmap needed)
- 10,000 records, 50 records/page at half full = 25 records/page → 400 data pages
  - Linked list: 400 data + 1 header = 401 pages
  - Page directory: 400 data + ceil(400/127) = 400 + 4 = 404 pages (each header holds floor((1024-8)/8)=127 entries)
- Heap vs sorted file true/false:
  - A: Scanning heap NOT strictly faster than sorted (same B IOs) → FALSE
  - B: Equality on PK not always faster in sorted (could be found on first page in heap) → FALSE
  - C: Range search on sorted typically faster → TRUE
  - D: Insertion into sorted NOT faster (very expensive) → FALSE

### Query Languages (20pts)
**Books/Library/Checkouts schema**:
- Q1: Return bid, genre of checked-out books without duplicates → C (SELECT DISTINCT with proper join)
- Q2: Fantasy books with checkout dates (include unchecked books with NULL) → A, C (LEFT JOIN and equivalent RIGHT JOIN with flipped tables)
- Q3: Library pairs with matching book titles → B, C (both use proper cross-product approach with < for ordering)
- Q4: Book checked out most times → B, C (HAVING COUNT >= ALL and ORDER BY/LIMIT approaches both work; A is invalid because aggregate in WHERE)
- Q5: Relational algebra for books from "City of Berkeley Library" → A only (π_title(B ⋈_bid=book (σ_lname="City of Berkeley Library" L)))

### B+ Trees (16pts)
**Students table: 100 records, heap file, 4 records/block at 75% full = 3 records/block → 34 data pages. Alt-2 B+ tree order 5, leaves hold 10 entries, fill factor 50% = 5 entries/leaf → 20 leaves.**

- Q1 worst case (SELECT * WHERE id=216972): 4 IOs (3 to traverse + 1 for heap page). Height=3 because 20 leaves, fanout up to 11, so 2 interior levels + root.
- Q1 best case: 3 IOs (traverse to leaf, find no match, no heap page needed)
- Q2 best case (INSERT): 6 IOs (4 to find + read heap page, 1 write heap, 1 write leaf)
- Q3 best case (DELETE WHERE name='John Smith'): 34 IOs (must scan entire heap file — WHERE is on name, not the indexed column id; best case if no match so no writes)

**B+-tree with order d=1, leaves hold 2 entries. Tree: [6] → [5],[10] → leaves [0,1],[5],[8],[10]**
- Max inserts without height change: 13 (tree can hold 18 entries at max capacity, currently has 5)
- Min inserts to change height: 4 (insert pattern like 2,3,4,4.1 to force cascading splits)
- Bulk load with 50% fill factor: 5 leaves (1 entry each) + 3 inner nodes = 8 total pages
- Root key after bulk load: 5

### Buffer Management (12pts)
- True statements: A (frame = page size), E (file < buffer → same hits for MRU/LRU)
- FALSE: B (buffer manager does NOT set dirty bit), C (dirty bit tracks modification not popularity), D (reference bits are Clock not LRU)
- Clock trace (4 frames, A,B,B,C,D,E,B,A,G,C,B): track ref bits and hand position carefully
- LRU trace (4 frames, T,H,I,S,I,S,A,R,E,A,L,L,Y,L,O,N,G,P,A,T,T,E,R,N): final buffer state determined by last 4 unique pages accessed that fit
- Repeated sequential scan (3 frames, 7 pages): MRU has more hits than LRU. Answer: E (MRU wins because LRU has 0 hits due to sequential flooding, MRU retains some pages)

---

# TOPIC 8: Common Exam Patterns

## SQL Questions
- "Which queries correctly answer X?" — multiple may be correct
- Watch for: missing DISTINCT, wrong join type, aggregate in WHERE, GROUP BY violations
- Integer division trap, NULL handling trap, NOT IN with NULLs

## IO Cost Questions
- Always clarify: heap or sorted? How many pages (B)?
- Heap equality: B/2 avg, B worst
- Sorted equality: log₂(B)
- Remember: insert into heap = 2 IOs (not 1!)

## B+ Tree Questions
- Trace insertions with splits: Leaf=COPY UP, Interior=PUSH UP
- Bulk loading: sort first, fill leaves to fill factor, build up
- "Is this valid?" — check order constraints, balanced depth, key ordering
- IO costs: height + data page access(es)

## Buffer Management Questions
- Full LRU/MRU/Clock traces — do step by step
- Clock: hand position matters! Starts where it stopped.
- Pin count vs dirty bit distinction
- Sequential flooding = LRU problem, not MRU

## Record Size Questions
- CHAR(n) = ALWAYS n bytes
- VARCHAR(n) = 0 to n bytes
- Don't forget header bytes
- Packed vs unpacked bitmap calculations

---

# TOPIC 9: Spring 2026 Midterm 1 Review Session (Supplemental)

## 9.1 Review Session Practice Problems — Buffer Management

### MRU Trace (4 buffer pages): I L O V E D B Y I P P E
- Fill: I, L, O, V (4 misses)
- E: evict V (MRU) → slot 4 = E (miss)
- D: evict E (MRU) → slot 4 = D (miss)
- B: evict D (MRU) → slot 4 = B (miss)
- Y: evict B (MRU) → slot 4 = Y (miss)
- I: **cache hit** (already in buffer)
- P: evict I (MRU) → slot 1 = P (miss)
- P: **cache hit**
- E: evict P (MRU) → slot 1 = E (miss)
- **Final pages: {E, L, O, Y}. 2 cache hits.**

### LRU Trace (4 buffer pages): A B T P H M O A A B A C B E A F G B
- Final pages: {G, F, B, A}. 4 cache hits.

### Clock Policy Detailed Walkthrough (6 frames)
Workload: A (pinned), B (pinned), C, D, E, F, G (pinned), F
- After loading A-F: all 6 frames full, all ref bits = 1
- Request G: hand starts at A
  - A: pinned → skip
  - B: pinned → skip
  - C: ref=1 → clear to 0, skip
  - D: ref=1 → clear to 0, skip
  - E: ref=1 → clear to 0, skip
  - F: ref=1 → clear to 0, skip
  - Back to A: still pinned → skip
  - B: still pinned → skip
  - C: ref=0, unpinned → **EVICT C**, load G, set ref=1, pin G
- Request F: already in buffer → **cache hit**, set ref=1

## 9.2 Review Session — KD Tree Nearest Neighbor Algorithm
1. Traverse down to find initial candidate nearest point
2. At each ancestor during backtrack:
   - Check if the OTHER subtree could contain a closer point
   - If distance to split plane < current best distance → search other subtree
   - Update best if closer point found
3. Application: RAG in LLMs — documents as vectors, find nearest neighbors

## 9.3 Review Session — Key Exam Reminders
- SQL duplicate rows: SQL uses BAG semantics (allows duplicates) unless DISTINCT
- SQL nondeterminism: LIMIT without ORDER BY, aggregate ties, NULL ordering
- B+ tree height for n records: h ≈ log_{2d+1}(n)
- B+ tree invariants: every non-root node has between d and 2d keys
- Clock policy: hand does NOT reset between requests — starts where it stopped
- Sequential flooding: LRU + scan > buffer = 0 hits. MRU fixes this.
- Sorted file insert cost: log₂(B) to find position + up to B reads + B writes to shift

## 9.4 Review Session — Out-of-Scope Topics (NOT on Midterm 1)
The review session also covered these topics which are NOT on Midterm 1:
- **Relational Algebra**: Unary operators (π, σ, ρ, γ), Binary operators (∪, ∩, —, ×, ⋈)
- **External Merge Sort**: Pass 0 sorts B-page runs, subsequent passes merge B-1 runs. Total passes = 1 + ⌈log_{B-1}(⌈N/B⌉)⌉. IO cost = 2N × passes.
- **External Hashing**: Partition phase (B-1 output buffers) then rehash phase. Recursive partitioning when partitions > B pages.
These will be on Midterm 2.
