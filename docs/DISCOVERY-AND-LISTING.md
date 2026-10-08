# Discovery and listing (Phase 2, Track B)

**Status: approved by the founder on 8 October 2026. Nothing has been posted or submitted yet.**
Where chess-variant players actually look, what each place accepts, and exactly what to submit. All
community facts were checked on 8 October 2026 [PHASE-2-SOURCES.md, S40–S58]. Community rules change,
so **re-read each venue's live rules on the day you post.**

---

## 1. Two different goals

| Goal | Means | Lasts | Examples |
|---|---|---|---|
| **Being listed** | A permanent, findable entry describing the variant | Years | The Chess Variant Pages, the GitHub repository, (later) wikis |
| **Being discussed** | Players try it, argue about it, and give feedback | Days or weeks per post | r/chessvariants, Chess.com forums, a Lichess blog, Hacker News |

A listing is how someone searching "chess variant king captures king" finds Mean Chess in two years.
A discussion is how the first 25 players arrive next month. Track B needs both, in that order of
urgency: listings are slow (editorial queues), so they start first.

**No big platform will host Mean Chess as a native variant:**
- **Chess.com** custom variants combine about two dozen built-in rule modules; there's no custom code
  [S45].
- **Lichess** supports standard chess and 8 variants, with no process for adding more [S46].
- **PyChess** needs Fairy-Stockfish support [S51], and Fairy-Stockfish's configuration language can't
  express royal moves at distance two, conditional cannibalism or "royal reach is not an attack" [S53].

Every road leads to **meanchess.siddheshthapa.com**. That's fine: it's free, needs no sign-up, and
already has a tutorial and a computer opponent.

## 2. What each channel is like today

### 2.1 The Chess Variant Pages (chessvariants.com)

The canonical encyclopedia of chess variants, run by volunteers since 1995 [S41].

| Question | Finding [S40] |
|---|---|
| Current status | **Unreachable on 8 Oct 2026**: a server test page in the browser, a Cloudflare challenge for scripts [S42]. It was down before, in 2018 and 2021. Treat it as temporarily down; check weekly. |
| How a variant is submitted | Register as a member, then use the **member submission form**. The first screen names and classifies the entry; then you write the page. |
| Who can submit | Any registered member. People credited before can claim their contributor entry; newcomers use the normal registration. Registration problems go to the webmaster (Fergus Duniho). |
| Editorial approval | **Yes.** "Nothing goes live until an editor signs off." Editors are volunteers (Fergus Duniho, Jeremy Gabriel Good, Joe Joyce, Tony Quintanilla, Ben Reiniger). |
| Page format | Four core sections plus optional notes. For an original game, the introduction should explain its origin and why it's worth playing. |
| Diagrams | A graphic diagram is preferred over a text board: your own GIF or PNG, or the site's Diagram Designer. Piece descriptions should match the diagram. |
| Naming | The title must be unique. Check the alphabetical index first; if it's taken, the site suggests putting your surname in front (for example "Thapa's Mean Chess"). Our web search found no existing "Mean Chess" [M4]. |
| Credits | The inventor and author are named on the page |
| External and implementation links | Pages commonly link to programs and websites that play the game, and the site has "external link" entries of its own. **Verify the current guidance when the site is back.** |
| Updates | Unpublished submissions are editable from the member menu ("Your Unpublished Submissions"). Published pages are edited by their authors and editors. |
| How long it takes | No published figure. Submissions "can sit unnoticed for a while"; a comment on the entry can nudge it; ignored entries may eventually be deleted. Plan on **weeks**. |
| Moderation and anti-spam | Editorial review of everything; no automatic publishing |

### 2.2 Chess.com

| Question | Finding |
|---|---|
| Can Mean Chess be a Chess.com custom variant? | **No.** The editor combines built-in modules (Atomic, Crazyhouse, King of the Hill, n-check, Capture Anything, Fatal Capture, Fog of War and so on) [S45]. "Capture Anything" lets pieces take their own side, but not under Mean's conditions (only the king, only in desperation, only the lowest tier). Nothing can express a king capturing the enemy king from two squares away. **Don't spend time forcing it.** |
| Official path for external variants | None found |
| Where variant players talk | The forums' variants category (thread URLs use the path `chess960-chess-variants`: verify the category name on the day), and variant clubs |
| Promotion rules | Community Policy (updated 25 Mar 2026): "Do not post spam, advertisements, or copy/paste comments and messages"; "Do not excessively promote your club" [S43]. Don't imply Chess.com endorses your content [S44]. No rule bans an external link in a genuine discussion. |
| Moderation friction | Medium. One discussion thread is normal; repeated or copy-pasted threads get removed. Brand-new accounts that post links look like spam. |

### 2.3 Lichess

| Question | Finding |
|---|---|
| Native variant? | **Not realistic.** "Lichess supports standard chess and 8 chess variants" [S46], with no published process for adding more. Community threads say no new variants are planned; those are forum claims, not policy. A pull request would also need support in Lichess's chess library, UI and engine. **Not a milestone.** |
| What Lichess *is* good for | **Blogs**: "some advertising and promotion … is allowed", but Lichess may limit the reach of mostly promotional posts. The "chess variants" tag is for genuine variant content. **Content "entirely or mostly generated by AI tools" is not permitted** [S47]. Also the forums (no spam: "irrelevant, unsolicited or repetitive messages" [S48]), and developer goodwill: the tutorial already sends beginners to lichess.org/learn. |
| Analysis | Lichess boards enforce standard rules, so Mean games can't be analysed there |

### 2.4 Reddit

| Community | Finding |
|---|---|
| **r/chessvariants** | About **14,000 members**, growing (+42% in a year). "New Variant" is its most-used flair. Rules (third-party snapshot dated 30 Sep 2026; **verify the live sidebar**) [S49]: (1) no promotion of the same app or site more than **once every two weeks**; (2) a variant is "chess, but with modifications"; (3) **put the variant's name in the title**; (4) Discord links are not trusted by default; (5) **"No AI slop"**; (6) **rules must be immediately visible and easily accessible**, meaning in the post, not behind a link. |
| r/chess | Huge, but self-promotion is limited, and accounts with no participation history may not self-promote [S50]. Not a launch venue. |
| r/chessbeginners | Promotional accounts are banned. No. |
| Reddit-wide | Moderators judge account history. Rule of thumb: mostly genuine participation, little promotion. |

### 2.5 PyChess and Fairy-Stockfish

- Since **7 July 2026**, signed-in PyChess users can upload their own variants as Fairy-Stockfish
  `variants.ini` definitions (Private, Unlisted or Public; always casual and unrated) [S52].
- Official variants require Fairy-Stockfish support: "We can't even consider adding variants that
  aren't supported by Fairy-Stockfish" [S51].
- Mean Chess's royal moves and conditional cannibalism are beyond that configuration language (our
  analysis [S53]). **No native listing.**
- The audience is exactly variant fans, though. Their community spaces (Discord, GitHub) are for
  PyChess itself, so treat them as a "later, carefully" channel.

### 2.6 Chess Stack Exchange

- A question-and-answer site. "The community here tends to vote down overt self-promotion and flag it
  as spam", and any mention of your own site must disclose your affiliation [S54].
- Its free "community promotion ads" for open-source projects are dormant: the only thread dates from
  2020, with no ads [S55].
- **Not a promotion channel.** At most, answer an existing question where Mean Chess is genuinely
  relevant, with disclosure.

### 2.7 Others worth knowing

| Channel | Verdict |
|---|---|
| **Hacker News, "Show HN"** | Fits a free, no-sign-up web game: "something you've made that other people can play with"; no landing pages [S56]. The technical story (a server-authoritative variant on Durable Objects, an AI board proven equal to the engine) suits the audience. **Tier 2**, once online play exists. It can spike traffic: on the free plan, the worst case is that the capacity guard stops new online games for the rest of that day (games in progress finish) and offers visitors the computer instead. |
| **The GitHub repository** | Already public and MIT licensed. Topics, the website field, a README GIF and a social-preview image make it findable through GitHub topic pages and search. **Tier 1** (cheap). |
| BoardGameGeek | Variants of public-domain games such as chess are out of scope for its database unless they're available in physical form [S57]. At most a post in the Chess entry's forum. Tier 3. |
| Chess Variants fandom wiki | An open wiki [S58]; its policy on original variants wasn't found. Tier 3, after the Chess Variant Pages listing exists. |
| Wikipedia | **Don't.** Notability requires independent coverage, and writing about your own game is a conflict of interest. |
| Discord servers | r/chessvariants distrusts Discord links [S49], and a Mean Chess server would be empty. Not now. |
| Short videos (YouTube Shorts, TikTok, Instagram Reels) | A 20-second Royal Slaughter or "Fool's mate fails" clip suits short video. Optional, Tier 2, made by the founder. |
| itch.io, Product Hunt | Possible later; low relevance to variant players. Tier 3. |

## 3. Channel ranking

Scores out of 5 (5 is best; for difficulty and friction, 5 means *easiest*).

| Channel | Relevance | Variant audience | Feedback | Traffic | Long-term discovery | Ease of submission | Low moderation friction | Tier |
|---|---|---|---|---|---|---|---|---|
| Chess Variant Pages | 5 | 5 | 2 | 2 | **5** | 2 (site down; editorial queue) | 3 | **1** |
| r/chessvariants | 5 | 5 | **5** | 3 | 2 | 4 | 3 | **1** |
| GitHub repository polish | 3 | 2 | 1 | 1 | 4 | 5 | 5 | **1** (prerequisite) |
| Chess.com forums | 4 | 3 | 3 | 3 | 2 | 4 | 3 | **1** |
| Lichess blog | 4 | 3 | 3 | 3 | 3 | 4 | 3 (reach may be limited) | **2** |
| Show HN | 2 | 1 | 4 | **5** (if it lands) | 3 | 4 | 3 | **2** |
| Short videos | 3 | 2 | 2 | 3 | 2 | 3 | 4 | 2 (optional) |
| PyChess community | 4 | 5 | 3 | 2 | 1 | 2 | 2 | 3 |
| Chess Stack Exchange | 2 | 2 | 2 | 1 | 3 | 2 | 1 | 3 |
| BoardGameGeek forum | 2 | 1 | 1 | 1 | 2 | 3 | 3 | 3 |
| Fandom wiki | 3 | 2 | 1 | 1 | 3 | 3 | 3 | 3 |

## 4. The discovery strategy

### Tier 1: do now (it doesn't need online play)

The site already has the full rules, a tutorial and a computer opponent. That's enough to ask variant
players for feedback on the *rules*, which is what they care about most.

| | **T1-1 Press kit and site metadata** | **T1-2 Chess Variant Pages** | **T1-3 r/chessvariants** | **T1-4 Chess.com forum** |
|---|---|---|---|---|
| Site or community | The site (`/press/` assets, meta tags), the GitHub repository | chessvariants.com | reddit.com/r/chessvariants | chess.com forums, variants category |
| Purpose | Every later step reuses it; link previews look right | Permanent, authoritative listing | First players and rules feedback | Reach Chess.com's variant players |
| Type | Assets plus metadata | Member submission, a full rules page | Text post with images, flair "New Variant" | Forum thread (discussion) |
| Account | None (GitHub settings: founder) | Chess Variant Pages member (founder) | Reddit (founder), with some history in the sub | Chess.com (founder) |
| Materials | §10 (press kit) | §5 page, 5–7 PNG diagrams | §6 skeleton; 1 GIF or 2 PNGs | §7 skeleton; 1 image |
| Exact content | §10 | §5 | §6 | §7 |
| Link destination | — | `https://meanchess.siddheshthapa.com/` plus `/rules/` and `/tutorial/` | The welcome page `/` (it routes to tutorial or play) | `/` |
| Expected friction | None | **High**: the site is down today, and the queue takes weeks | Medium: rules compliance, account history | Medium: new-account link filters |
| Next action | Claude builds it (B1) | Founder checks weekly; registers when reachable (B4) | Founder joins and participates for 1–2 weeks (B3), then posts (B5) | Founder posts at least 1 week after Reddit, with different words (B6) |

### Tier 2: after online play exists (v0.3 beta stable for at least a week)

Online play makes these more credible, and gives a reason to come back.

- **r/chessvariants follow-up** (2+ weeks after the first post): what changed thanks to their
  feedback, plus "now playable online with a friend".
- **Lichess blog post**: a design story, not an advert ("Designing a king that kills"), with diagrams
  and puzzles. Founder-written, no AI text [S47]. Tag "chess variants".
- **Show HN**: after checking quota headroom. Upgrading first is optional (F-A7); on Free, a very busy day
  only closes *new* online games until 00:00 UTC, with the computer offered instead.
- **Chess.com**: a reply in the founder's original thread, not a new thread.
- Optional short videos.

### Tier 3: later, low value or high friction

PyChess community; Chess Stack Exchange (answers only, with disclosure); BoardGameGeek's Chess forum;
the fandom wiki; itch.io and Product Hunt.

## 5. Chess Variant Pages: checklist and page

**Checklist:**

1. ☐ The site loads normally (not the test page). If not: check weekly; don't wait on it, and carry on
   with Reddit.
2. ☐ Search the alphabetical index for "Mean Chess". If it's taken, use "Thapa's Mean Chess".
3. ☐ Read the live submission guidance (sections, image rules, any policy on AI-assisted text) and
   adjust this outline to match.
4. ☐ Register (founder). If registration fails, use the contact on the feedback page.
5. ☐ Diagrams ready: 5–7 PNGs (see below), made from Scenario Lab positions by Claude (B1).
6. ☐ Member submission form: name **Mean Chess**; the classification closest to "rule changes,
   standard board and pieces"; inventor and author **Siddhesh Thapa**; year **2026**.
7. ☐ Paste the page (below). The founder reviews the text and submits it **in their own name**: it's
   their game. Claude's draft is based on `docs/RULES.md`, the canonical rules.
8. ☐ Note the submission date in the handover. After **3 weeks** with no response, post one polite
   comment on the entry. After **6 weeks**, write to an editor via the feedback page.
9. ☐ Once published, add "Listed on the Chess Variant Pages" with the link to the README and the rules
   page.

**Page outline**, fitted to the site's four core sections plus notes. Every rule statement matches
RULES.md v0.1.

| Section | Content |
|---|---|
| Title, credits | **Mean Chess.** Inventor and author: Siddhesh Thapa, 2026. Rules version 0.1. |
| **Introduction** | Standard chess, plus three powers for the king. Where the idea came from, in the founder's own words. Why it's worth playing: kings become attackers, king walks become deadly, classic mates change. A link to play free (no sign-up), with a tutorial and a computer opponent. |
| **Setup** | The standard starting position (diagram 1). No new pieces. |
| **Pieces** | All pieces move as in chess. Queens are tracked by origin: the *original* queen, and *promoted* queens (written `Q~` in MeanFEN). The king gains the royal moves below. |
| **Rules** | (1) **Royal distance:** kings exactly two squares apart on a rank, file or diagonal; the square between is the midpoint. (2) **Royal Capture:** midpoint empty, so the king captures the enemy king and wins (diagram 2). (3) **Royal Slaughter:** the midpoint holds one of the mover's own *eligible* pieces, so the king consumes it and captures the enemy king in one move, and wins (diagram 3). (4) **Blocking:** any enemy piece on the midpoint blocks every royal move (diagram 4). (5) **The Royal Kill Zone:** standing at royal distance is legal but dangerous; it is never check; adjacent kings stay illegal. (6) **Sacrifice hierarchy (global):** pawns → knights and bishops → rooks → promoted queens. Only the lowest tier you still have anywhere is eligible. The original queen and the king are never eligible. (7) **Royal Cannibalism:** if you're in check, have no royal move, and every ordinary move is *suicidal* (it hands the opponent a royal move) or you have none, your king may capture an adjacent eligible piece of its own, provided it's not in check afterwards (diagram 5). (8) **Checkmate:** in check with no legal move after all of the above. (9) **Draws:** stalemate, threefold repetition (automatic), the fifty-move rule (automatic), agreement. **No insufficient-material draws**: lone kings can still capture each other, and K+N vs K and K+B vs K are wins. (10) **Order of endings:** royal capture or slaughter → checkmate or stalemate → fifty-move → threefold → agreement or resignation. (11) **Notation:** K×K, K×P×K (slaughter), K×e2 (own P) for cannibalism. |
| **Notes** | Strategy: a piece between the kings is its owner's shield *and* its owner's weapon; corners are deadly in endings; Fool's mate fails (the king eats a pawn), Scholar's mate still works (diagram 6). Two or three example positions with solutions (diagram 7). The playable implementation: website, tutorial, computer opponent, online play once released. Source code: GitHub, MIT. Version history: Rules v0.1, October 2026. |

**Diagrams** (PNG, about 360 px, Mean theme or a plain light theme):

| # | Shows | Position (all exist in Scenario Lab, with deep links) |
|---|---|---|
| 1 | Standard start | Start position |
| 2 | Royal Capture | `/play/?scenario=royal-capture-in-check` |
| 3 | Royal Slaughter | `/play/?scenario=slaughter-pawn` |
| 4 | An enemy piece blocks | `/play/?scenario=enemy-blocker` |
| 5 | Royal Cannibalism | `/play/?scenario=cannibal-back-rank` |
| 6 | Fool's mate fails | `/play/?scenario=fools-mate` |
| 7 | Hierarchy: pawns go first | `/play/?scenario=slaughter-blocked` |

## 6. r/chessvariants: the first post

**Before posting:**
- Use the founder's own Reddit account.
- Join the sub, and spend 1–2 weeks commenting genuinely on other people's variants.
- Read the live sidebar; the rules may differ from the snapshot [S49].

**The post.** The founder writes it in their own words: the sub bans "AI slop", and its readers can
tell. Claude provides the facts, images and this skeleton.

| Part | What goes there |
|---|---|
| Flair | New Variant |
| Title (variant name first, rule 3) | For example: "Mean Chess: kings can capture kings from two squares away, and eat their own pieces to survive" |
| 1. Who you are | One line: you designed it, and here it is (honest disclosure) |
| 2. **The rules, in the post** (rule 6) | 5–6 bullets: royal distance, Royal Capture, Royal Slaughter, blocking by an enemy piece, Royal Cannibalism with the hierarchy, original vs promoted queens. One line on draws (no insufficient material). |
| 3. One picture | The Royal Slaughter GIF ("King, pawn, king"), or two PNGs |
| 4. Try it | One link to the site: free, no sign-up, tutorial, computer opponent |
| 5. Two specific questions | For example: "Is Royal Slaughter through a knight too strong in endgames?" and "Do the cannibalism conditions read clearly?" Specific questions get specific answers. |
| 6. Optional | "It's open source (MIT)", with the repository link |

**After posting:**
- Reply to every comment within 24 hours.
- Log every piece of feedback (date, who, what, response) in a GitHub issue labelled `feedback`.
- No second promotional post for at least two weeks (rule 1).
- Never post the same text anywhere else.

## 7. Chess.com: the forum post

- **Where:** Forums → the variants category. Thread URLs use `chess960-chess-variants`; confirm the
  category name on the day.
- **Account:** the founder's Chess.com account. If it's new, read a few threads and reply to one or two
  first, since new accounts posting links can be filtered.
- **Title:** for example "I designed a variant where kings can kill kings (Mean Chess): feedback
  wanted". The founder writes it.
- **Body:** a short rules summary in **different words from the Reddit post** (the Community Policy
  forbids copy-paste [S43]); 1 image; **1 link** (the site); one question; disclosure ("I made this").
- **Don't:** open more than one thread; post in clubs you're not a member of; message people
  privately; imply Chess.com's endorsement [S44].
- **Showing interest:** only real evidence, once it exists (for example "players on r/chessvariants
  suggested X, so I changed Y"). Never invent numbers.

## 8. Lichess: realistic and not

| Realistic | Not realistic |
|---|---|
| One founder-written blog post after online play exists (Tier 2): a design story with diagrams and two puzzles, tagged "chess variants" [S47] | Getting Mean Chess added as a Lichess variant |
| Joining existing variant discussions in the forums when genuinely relevant [S48] | Analysing Mean games on Lichess (its boards enforce standard rules) |
| Continuing to send beginners to lichess.org/learn from the tutorial (goodwill) | Promotional forum threads |

## 9. Founder actions, click by click

Tier 1 needs the founder because posts must come from a real person's account, in their own voice.

**F-B1. GitHub repository settings** (5 minutes; after Claude's B1):
1. Open https://github.com/OnePanda2/Mean.Chess and click the **gear icon** next to **About** (right
   column).
2. **Website:** `https://meanchess.siddheshthapa.com`.
3. **Topics:** `chess`, `chess-variant`, `chess-variants`, `board-game`, `browser-game`, `typescript`,
   `react`. Click **Save changes**.
4. **Settings** (repository tab bar) → **General** → **Social preview** → **Edit** → **Upload an
   image** → choose `public/press/social-preview.png` from the press kit.

**F-B2. Reddit:**
1. Sign in at https://www.reddit.com, or create an account (**Log In** → **Sign Up**).
2. Open https://www.reddit.com/r/chessvariants and click **Join**.
3. For 1–2 weeks, comment helpfully on other people's variant posts.
4. Read the sidebar rules again on posting day.
5. Click **Create Post** → choose r/chessvariants → **Text** (or **Images & Video** for a GIF) → enter
   the title → write the body (§6) → add the image → click **Add flair** and choose **New Variant** →
   **Post**.
6. Stay available for the next few hours to answer comments.

**F-B3. Chess Variant Pages** (when the site is back):
1. Open https://www.chessvariants.com and check it shows the normal site.
2. Find **Register** or **Sign up** (the member menu), create the account and confirm your email.
3. Open the member submission page (https://www.chessvariants.com/index/membersubmission.php): name
   "Mean Chess", classification, then the page content and diagrams (§5).
4. Submit, and tell Claude the date so it goes into the handover.

**F-B4. Chess.com:**
1. Sign in at https://www.chess.com → **More** (or the menu) → **Forums**.
2. Open the variants category, then **New topic** (or **Create**).
3. Enter the title, the body (§7) and one image, then **Post**.

**F-B5 (Tier 2). Lichess blog:**
1. Sign in at https://lichess.org → your profile menu → **Blog** → **New post**.
2. Add a title image, write the post (§8), and add the tag "chess variants".
3. Publish.

**F-B6 (Tier 2). Show HN:**
1. Sign in at https://news.ycombinator.com → **submit**.
2. Title starting with "Show HN: " (for example "Show HN: Mean Chess, a chess variant where kings can
   kill kings").
3. URL: the site.
4. Then add a first comment, in your own words, on how it was built and what's different.

## 10. The press kit

Texts live in `docs/PRESS-KIT.md` (to be created, B1). Images go in `public/press/`, served at
`https://meanchess.siddheshthapa.com/press/…` so every venue links to the same files. Claude drafts
the descriptive texts below (site copy, not community posts); the founder approves them.

| # | Item | Content or file |
|---|---|---|
| 1 | One sentence | "Mean Chess is standard chess with a deadlier king: it can kill the enemy king from two squares away, and eat its own army to survive." |
| 2 | About 50 words | "Mean Chess is ordinary chess with a lethal king. A king two squares from the enemy king, in a straight line, captures it and wins instantly, even by eating its own piece in between. Trapped in check, a king may eat an adjacent friendly piece to escape, pawns first. The original queen is never food." |
| 3 | Rules summary (about 150 words) | The rules row of §5, condensed, ending with a link to `/rules/` |
| 4 | What makes it different | (a) Only kings can capture kings, from two squares away: Royal Capture. (b) A king can eat its own piece standing between the kings to do it: Royal Slaughter. (c) A trapped king can eat its own neighbour to escape check: Royal Cannibalism. (d) A strict sacrifice order: pawns, then knights and bishops, then rooks, then promoted queens. (e) The original queen is untouchable; promoted queens are not. (f) An enemy piece between the kings blocks everything, so every piece between them is its owner's shield and weapon. |
| 5 | Screenshots | `screenshot-mean.png` (1600×1000, mid-game, Mean theme); `screenshot-themes.png` (the four themes side by side) |
| 6 | Short clips | `royal-slaughter.gif` and `.mp4` (about 6 s); `cannibalism.gif` and `.mp4` (about 6 s). Captured with Playwright's video recording from the Scenario Lab links. Converting to GIF needs ffmpeg (founder approval to install), or the founder records with Windows Game Bar (Win+G). |
| 7 | Live link | https://meanchess.siddheshthapa.com |
| 8 | Rules | https://meanchess.siddheshthapa.com/rules/ |
| 9 | Tutorial | https://meanchess.siddheshthapa.com/tutorial/ |
| 10 | Creator | Siddhesh Thapa (F12, confirmed) |
| 11 | Version | Rules v0.1; site version at the time of posting |
| 12 | Contact | GitHub Issues: https://github.com/OnePanda2/Mean.Chess/issues (F7) |
| 13 | Source | https://github.com/OnePanda2/Mean.Chess (MIT) |
| 14 | Example game | A short, real game ending in a Royal Slaughter, chosen from computer self-play (`npm run selfplay`), checked by the engine, given as Mean Chess Notation plus a "load this game" file |
| 15 | Example special moves | The five demonstration scenarios (§12), each with its deep link |
| + | Link previews | `og.png` (1200×630, for Open Graph and Twitter cards on every page, including invite links); `social-preview.png` (1280×640, GitHub) |

## 11. Positioning

**For variant players, in two sentences:**
- Mean Chess is played with a normal set: standard chess plus three powers for the king. Royal
  Capture kills the enemy king from two squares away; Royal Slaughter eats your own piece in between
  to do it; Royal Cannibalism eats a neighbour to escape a check you can't otherwise survive.
- With a strict sacrifice order and an untouchable original queen, kings become attackers, king walks
  turn deadly, and even the classic mates change.

**Taglines:**
- "Kings kill kings."
- "The king is the deadliest piece on the board."
- "Fool's mate doesn't work here."

**Don't say:**
- "chess with self-capture" (it undersells the game; the brief is right);
- "the first variant ever to…" (thousands of variants exist, and their fans will check);
- anything implying Chess.com or Lichess endorsement;
- "AI-designed" (it isn't, and it would put off this audience).

## 12. Demonstration content

The tutorial's lessons and Scenario Lab already contain verified positions for every mechanic, and
Scenario Lab has **deep links today**, so no new demonstration content needs inventing. The five to use:

| # | Shows | Link (exists) | Matching tutorial lesson |
|---|---|---|---|
| 1 | **Royal Capture**, even while in check | `/play/?scenario=royal-capture-in-check` | "Kings capture kings" |
| 2 | **Royal Slaughter** | `/play/?scenario=slaughter-pawn` | "Royal Slaughter" |
| 3 | **Sacrifice hierarchy** | `/play/?scenario=slaughter-blocked` → `slaughter-knight` | "Pawns go first" |
| 4 | **Royal Cannibalism** | `/play/?scenario=cannibal-back-rank` | "Royal Cannibalism" |
| 5 | **Fool's mate fails** (the hook for chess players) | `/play/?scenario=fools-mate` | (the "Desperate" lesson covers the rule) |

Optional extras:
- the Kill Zone ending (`corner-zugzwang`);
- the queen pair: `original-queen` vs `cannibal-promoted-queen`.

**Use:** "see it" links go to Scenario Lab; "learn it" links go to the tutorial. A small, optional
improvement: `/tutorial/?lesson=<id>` deep links, so a post can open a specific lesson.

## 13. The traction loop

```
community post / listing ──► welcome page ──► tutorial (8 lessons) ──► play the computer
        ▲                                                                   │
        │                                                                   ▼
 share a memorable finished game ◄── rematch ◄── game ends ◄── friend joins ◄── "Play a friend online"
 (link shows it for 30 days)                                       ▲              (invite link)
                                                                   │
                                       the join screen teaches the 3 key rules
```

How existing features feed it, and the few small builds that strengthen it:
- **The tutorial and the computer** turn a curious visitor into someone who can play, before they
  invite anyone. Add a "Play a friend online" prompt after finishing the tutorial and after beating the
  computer (v0.3).
- **The invite link carries its own teaching:** the join screen shows the quick rules, so a friend
  who's never heard of Mean Chess isn't lost (v0.3).
- **Link previews:** `og.png` and good meta tags make an invite pasted into WhatsApp or Discord look
  like a game, not a bare URL (T1-1).
- **Finished-game links** make the best moments shareable (v0.3).
- **Rematch** keeps a pair playing (v0.3).
- **No dead ends:** when online play is full for the day or the server can't be reached, the page
  offers the computer at the player's Auto level, clearly labelled (P2-31 to P2-33). A visitor never
  hits an error.
- **No paid growth,** no referral schemes, no growth hacks.

## 14. Analytics: the minimum

| Layer | What | Recommendation |
|---|---|---|
| Page visits and referrers | Cloudflare Web Analytics: free, cookieless by Cloudflare's account, no DNS change, a JavaScript snippet [S28] | **Yes (approved, F6a), from the first Track B post**, so each post's traffic can be seen. It counts visits, not people, and ad blockers hide some visits. |
| Online game events | Server-side counters in Workers Analytics Engine: games created, joined, finished (by reason, including royal capture, royal slaughter and cannibalism endings), rematches, reconnects, rejections, latency [S13] | **Yes, built into v0.3.** No client tracking needed. |
| Funnel events | Four anonymous beacons to `/v1/events`: tutorial started, tutorial completed, computer game started, friend game started. Counts only; no ids, no storage. Batched (one request per visit) and sampled 1 visit in 4 (P2-34). | **Yes (approved, F6b), with v0.3**: anonymous and minimal. It's the only way to measure "tutorial completions". |
| Not doing | Google Analytics, cookies, user or device ids, session recording, per-move tracking, A/B testing | — |

Privacy implications are in [ONLINE-SECURITY.md](ONLINE-SECURITY.md) §8. The privacy page lists all of
it.

## 15. Discovery metrics

| # | Metric | Target | By when | Measured with |
|---|---|---|---|---|
| 1 | Press kit and metadata done | Done | B1 + 1 week | Checklist |
| 2 | Chess Variant Pages submitted | Submitted | Within 1 week of the site being reachable | Handover entry |
| 3 | Chess Variant Pages published | Live page | Within 60 days of submission | The page |
| 4 | Tier 1 community posts | 2 (Reddit, Chess.com) | Within 4 weeks of approval | Links in the handover |
| 5 | Feedback collected | ≥ 15 distinct points; ≥ 3 acted on | 4 weeks after the first post | GitHub `feedback` issues |
| 6 | Visitors from community referrers | ≥ 300 visits | 4 weeks after the first post | Web Analytics referrers |
| 7 | First external players | ≥ 25 (tutorial completions, or computer or friend games started) | 6 weeks after the first post | Funnel beacons (F6b), or online seats claimed |
| 8 | Online games between non-founder players | ≥ 10 | 4 weeks into the v0.3 beta | Analytics Engine |
| 9 | Invite acceptance | ≥ 50% of created games get joined (excluding aborted) | During the beta | Analytics Engine |
| 10 | Rematch rate | ≥ 25% of finished online games | During the beta | Analytics Engine |
| 11 | Games per online player | ≥ 2 on average (proxy: rematches plus repeat invites) | During the beta | Analytics Engine |
| 12 | Retention | **Not measurable in v0.3** without device ids (deliberately). Proxy: returning-visit trends, and the same people commenting again. Revisit with accounts. | — | — |

## 16. Track B steps in order

| Step | Who | What | Depends on |
|---|---|---|---|
| B0 | Founder | Approve the blueprint, incl. F6a (Web Analytics), F7 (contact), F12 (name). **Done 8 October 2026.** | — |
| B1 | Claude | Press kit (`docs/PRESS-KIT.md`, `public/press/`), `og.png` and meta tags on all pages, diagrams, clips, example game, Chess Variant Pages page draft | B0 |
| B2 | Founder, then Claude | Web Analytics (F-A8), then Claude adds the snippet; GitHub settings (F-B1) | B0, B1 |
| B3 | Founder | Join r/chessvariants and participate for 1–2 weeks | B0 |
| B4 | Founder | Chess Variant Pages: check weekly; register and submit when it's reachable (F-B3) | B1 |
| B5 | Founder | r/chessvariants post (F-B2) | B1, B2, B3 |
| B6 | Founder | Chess.com post, at least 1 week after B5, in new words (F-B4) | B5 |
| B7 | Claude and founder | Feedback log; fix rule-text confusions in the tutorial and rules page (never the rules themselves without a founder ruling) | B5 |
| B8 | Founder | Tier 2 (Reddit follow-up, Lichess blog, Show HN), once the v0.3 beta has been stable for a week | A11 |
| B9 | Claude | 8-week review of the §15 metrics; next steps | B5 + 8 weeks |
