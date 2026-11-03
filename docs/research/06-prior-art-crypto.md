# Prior art dla pomysłów crypto-native (research 2026-11-03, wieczór)

Trzy równoległe researche konkurencji dla pomysłów: (1) AI delegat DAO + watchdog propozycji, (4) auto-weryfikowane bug bounty smart kontraktów, (5) scoring kredytowy i pożyczki dla agentów.

## 1. AI delegat DAO + watchdog złośliwych propozycji

### Co istnieje (delegaci, którzy naprawdę głosują)
| Projekt | Kiedy | Co robi | Status | Przejrzystość rozumowania |
|---|---|---|---|---|
| Governatooorr (Valory/Olas) | IV 2023 | przełącznik "good/evil", głosuje autonomicznie | martwy | brak |
| Blockful AI Delegates | III–VII 2024 | "bias prompt" + konstytucja DAO → głos + akapit uzasadnienia; ENS, propozycja 5M ARB na Arbitrum | martwy | tekst, bez dowodów |
| **Event Horizon** | IX 2024–2025 | Arbitrum DAO delegowało **7M ARB** do agentów per użytkownik; w VI 2025 **obcięte do 100K ARB** | częściowo | delegaci (StableLab, GFX) obcięli *za brak przejrzystości decyzji* |
| DeGov (degov-agent.eth) | IX 2025 | ENS, Summer; głosuje wg sentymentu z X i innych delegatów | live | wyjaśnienie per głos, bez dowodów |
| Optimism "AI Delegate" mission | 2025 | 4 zespoły, 8–14K OP; spec wymagał **publicznego śladu rozumowania i weryfikowalności głosów** | "cichy eksperyment", nikt nie dostarczył | — |
| GoverNoun | VIII 2025 | Nouns/Polkadot; rationale na IPFS, "lobbyable" | Nouns live | sentyment, nie bezpieczeństwo |
| Quack AI | 2025–26 | BNB/Arbitrum; presety wag; token Q | live | audit logs "planowane" |
| NEAR House of Stake | 2026 | "cyfrowe bliźniaki" delegatów | testnet | planowane |

Hackathony (ETHGlobal 2024–26): AutoVote, Synthetic Senators, Minerva, Proxy, Regent (ERC-7710 scoped delegation, tylko `castVote`), MoltDAO. Żaden nie łączy głosowania z symulacją.

### Co istnieje (watchdog)
- **Seatbelt** (Uniswap/Compound/ENS): symulacja forka + Slither, bez LLM, bez alertów. https://github.com/Voltz-Protocol/governance-seatbelt
- **Certora Quorum** (I 2025, beta, 14★): diff bytecode + LLM porównuje opis IPFS z payloadem; Aave. https://github.com/Certora/Quorum
- **Blockful Anticapture**: ekonomia przejęcia DAO, alerty; 8 z 11 DAO nie zapłaciło. https://github.com/blockful/anticapture
- **Hypernative**: enterprise, ML, człowiek przegląda każdy alert; ich własny post-mortem BonkDAO: "nic nie oznaczyło propozycji przez 6 dni".
- **"Mind the Gap"** (ACM CCS 2026, arXiv 2609.13601): LLM evidence-mapping per akcja, 81.7% precision / 98.3% recall; **brak narzędzia**.
- **SenateAI** (Chainlink hackathon III 2026): symulacja + 4 agenty debatują + score on-chain; **nie głosuje**, nie wygrał.
- **Verifiable DAO Risk Agent** (megabyte0x, TEE): podpisany raport z symulacji; bez delegata, bez adopcji.

### Sygnały popytu
- Tally zamknięte 17 III 2026 ("nie ma biznesu VC w governance tooling").
- **BonkDAO stracił ~$20M** (VII 2026) przez złośliwą propozycję, 0 s timelock, 7 głosujących.
- Binance ręcznie zatrzymał drenaż $1.2M z innego DAO (VIII 2026).
- Vitalik, 21 II 2026: "personal AI stewards" do głosowania.
- Compound Prop 289 (VII 2024, $24M) wyłapany ręcznie przez OpenZeppelin i Wintermute.

### Biała przestrzeń
1. **Delegat + watchdog w jednym**: nikt nie uzależnia głosu od werdyktu symulacji; nikt, kto wykrywa, nie może zagłosować.
2. **Weryfikowalne, dowodowe uzasadnienie per głos**: hash mandatu + hash calldata + hash śladu symulacji + cytowane dowody + wersja promptu → podpisany raport → `castVoteWithReason`. Dokładnie to, czego Optimism wymagał i Arbitrum ukarał za brak.
3. **Mandat w języku naturalnym testowany regresyjnie na historycznych atakach** (Build Finance, Tornado, Compound 289, BonkDAO): "czy mój delegat zagłosowałby NIE?"
4. **"Security-only" delegat** z ograniczoną, odwoływalną mocą (może tylko AGAINST/ABSTAIN, nigdy FOR) — zamienia zarzut "kto odpowiada, gdy AI źle zagłosuje" w cechę.
5. Korelacja świeżej akumulacji tokenów z oczekującą propozycją (wzorzec BonkDAO/Tornado/Compound).

### Werdykt
Goły "LLM czyta i głosuje" = widziane 10 razy, jurorzy to odrzucą. Fuzja delegat + symulacja + dowodowe uzasadnienie + security-only + test regresyjny na atakach = nieobsadzone i z żywymi sygnałami popytu z 2026.

## 4. Auto-weryfikowane bug bounty smart kontraktów

### Co istnieje
| Projekt | Kiedy | PoC auto? | Severity | Wypłata | Status |
|---|---|---|---|---|---|
| **HoneyPause** | EthDenver 2024 | tak, **on-chain** (verifier pre/exploit/post, revert) | brak | stała, atomowo z pauzą | **tylko Sepolia**, 42★ |
| **ExploitArena** | IV 2026 hackathon | tak, 5 agentów-weryfikatorów, CVSS 4.0, escrow 3/5 | AI | tiered z puli | **lokalny Hardhat**, 0★, toy reentrancy |
| Hydra (USENIX 2018) | 2017 | N-wersji, bounty przy rozjeździe | — | on-chain | akademickie |
| Immunefi Vaults | 2023 | nie (ludzie) | ludzie | z Safe przez dashboard | live; 10% fee; **AI-raporty zakazane** |
| Immunefi Magnus | 2025 | nie | "security swarm" — release pending | — | — |
| Hats Finance | 2021 | nie | komitet | on-chain vault | niska aktywność |
| Cantina/Spearbit | 2026 | skan AI, dedup | AI-assisted | ręcznie | $8M |
| Sherlock, HackenProof, Remedy | — | nie | ludzie | ręcznie | live |
| Code4rena | — | — | — | — | **zamknięte V 2026** |
| EVMbench (OpenAI+Paradigm, II 2026), SCONE-bench (Anthropic, XII 2025) | — | sandbox ocenia exploit po saldach | benchmark | — | OSS |
| realism-gate (2026) | — | statyczny checker PoC (prank(owner), deal(), unpinned fork); 69% testów DeFiHackLabs nic nie asertuje | — | — | 0★ |

Fakty o bólu: Immunefi zbanowało 15 kont za raporty z ChatGPT; regulamin wciąż zakazuje raportów AI; udokumentowany przypadek agenta fabrykującego dowód z forka (anthropics/claude-code#58739); programy BNB/Morpheus wymagają Foundry fork @ pinned block + asercji sald.

### Biała przestrzeń
1. **Fork mainnetu jako jedyna wyrocznia** (pinned block, prawdziwy bytecode, mierzony ubytek salda ofiary, atakujący = świeże EOA bez uprawnień).
2. **Deterministyczna wypłata z puli on-chain** = min(10% × zmierzony drenaż, cap per bug, cap per program, pozostała pula).
3. **AI jako bramka anty-fabrykacji i tłumacz, nie sędzia** (reguły realism-gate jako kod, klasyfikacja, raport dla ludzi).
4. Atestacja przebiegu (TEE / N runnerów 3-z-5 na prawdziwym forku), hash on-chain przed wypłatą.
5. Sprzężenie z reakcją: werdykt pauzuje funkcję (wzorzec HoneyPause).
6. Submission dla agentów (MCP) + stake-to-submit przeciw spamowi.

### Werdykt
Nowe w integracji, nie w częściach; jurorzy wymienią HoneyPause, Immunefi Vaults, Hydra, EVMbench. Pitch: "Immunefi Vaults z maszynowo sprawdzalną wyrocznią", cytować HoneyPause/Hydra jako rodowód. Kto zamknie lukę weryfikacji, która trzymała każdą wcześniejszą próbę na testnecie, wygrywa.

## 5. Scoring kredytowy i pożyczki dla agentów

### Co istnieje
- **Priors** (Robinhood Chain, USDG, mainnet IX 2026): $5–500, 1–30 dni, 1%/30d; score 0–1000; ~292 agentów, >$360k spłacone, **TVL $6.6k**, token mcap ~$12M, bez audytu; **brak kredytu bez pokrycia** (sponsor / stake $PRIORS / stock tokens); sam przyznaje: "pokazuje, czy agent spłacał, nie czy jego usługa jest dobra". https://priors.trade
- Clawloan (Base/Linea): $360 TVL. RSoft Bank (x402 listing): niezweryfikowane. Bank of Bots: 1 pożyczka IV 2026, pivot.
- Hackathony testnetowe: CreditMesh, Fiduciary Agent, Atlas, Agent Credit (delegacja Aave właściciela).
- **Omnequa testbed** (29 X–1 XI 2026): 72-h eksperyment "pożyczka na koszt zadania, spłata z zapłaty klienta" → **"QUALIFIED DEMAND NOT DEMONSTRATED"**.
- ERC-8004 Reputation Registry: badanie (arXiv 2606.26028) — 59–90% feedbacku to Sybil; "nie może służyć jako sygnał zaufania".
- Kite: reputacja w whitepaperze jako cel, bez formuły i API. Reppo: nikt nie używa jako wejścia kredytowego.

### Biała przestrzeń
Underwriting z jakości pracy (Reppo) + historii płatności Passportu; pożyczka pod konkretną należność; recourse przez stake ewaluatorów / właściciela.

### Werdykt
Żywa kategoria, więc "scoring + pożyczki" = klon Priorsa; nowość tylko w źródle danych; popyt niewykazany (Omnequa). Najwyższe ryzyko produktowe z trójki.

## Synteza: fuzja 1 + 4

Wspólna oś: **bezpieczeństwo DAO**, dwa wektory ataku (governance i kod), dziś bronione osobnymi, nieautomatycznymi światami. Produkt-fuzja: **delegat security-only z pulą bounty za dowody**:
- Każda propozycja → symulacja na forku + mapowanie opis↔calldata (SERV multipath, ślad dowodowy) → raport podpisany, hash w `castVoteWithReason` → głos AGAINST/ABSTAIN tylko w razie flagi.
- Ludzie i agenty mogą zgłosić dowód (PoC na forku), że propozycja lub kod są złośliwe → auto-weryfikacja na forku → wypłata z puli w capach (Kite) → delegat głosuje przeciw.
- Reppo: niezależna druga opinia przed oddaniem głosu AGAINST (ochrona przed fałszywym alarmem).
- Dolphin: tanie czytanie forów/długich propozycji.
- Mandat użytkownika testowany regresyjnie na replayu historycznych ataków z publiczną kartą precision/recall.
