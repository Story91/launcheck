# SERV Hackathon 02

Zgłoszenie na [SERV Hackathon — Edition 02](https://www.openserv.ai/hackathon-2) (OpenServ, 2–15 XI 2026).

> Status: faza wyboru pomysłu. Zobacz `docs/ideas/2026-11-03-five-ideas.md`.

## Struktura

```
.
├── CLAUDE.md                 # kontekst dla Claude Code: wymagania, decyzje, workflow
├── .env.example              # wszystkie klucze (SERV, Dolphin, Reppo, Kite)
├── docs/
│   ├── hackathon-checklist.md     # deadline, wymagania zgłoszenia, harmonogram 14 dni
│   ├── ideas/                     # kandydaci na projekt
│   ├── research/                  # 01 SERV · 02 Dolphin · 03 Kite · 04 Reppo · 05 prior art
│   ├── vendor/                    # pobrane indeksy docs partnerów (offline reference)
│   └── superpowers/{specs,plans}/ # design doc i plan implementacji (po wyborze pomysłu)
└── scripts/                  # smoke-testy API partnerów
```

Skille Claude Code (uruchom raz): `npx -y skills add openserv-labs/skills --agent claude-code --yes`

## Szybki start

1. Skopiuj `.env.example` → `.env`, wpisz klucz SERV z https://console.openserv.ai.
2. `node scripts/smoke-serv.mjs` — pierwsze wywołanie SERV Reasoning.
3. Przeczytaj `docs/hackathon-checklist.md`.

## Linki

- Docs SERV: https://docs.openserv.ai/llms.txt
- Formularz zgłoszenia: https://openserv.typeform.com/submissions02
- Discord OpenServ: https://discord.com/invite/9u724WsWCU
