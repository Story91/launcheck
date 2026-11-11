# Review: "Here's your receipt" (LaunCheck film v3)

File: `launcheck-machine-16x9.mp4` (rendered locally, not committed), 1920x1080, 21 s, landscape. Render: `npx hyperframes render --quality delivery -o launcheck-machine-16x9.mp4` in this folder.

Format follows the Delivered vault sketch: a "POV" hook in the first second, a three-beat sketch (pay, find, fix), speaker-labelled captions so it works muted, one quotable payoff on the end card, product only at the end.

- Video: three 5 s Kling 3.0 Pro clips (Higgsfield, 16:9, silent), all started from one gpt_image_2_6 still so the robot and the machine match. The numbers on the machine screen ($0.005 PAID, 10 FOUND, 6 GONE) are HyperFrames overlays.
- Voices: ElevenLabs eleven_v4 (agent and check machine), sound effects (coin, card, alarm, receipt printer) and the music bed from ElevenLabs; impact from the HyperFrames bundled library.
- Facts match recorded reports: phone render $0.005 paid in USDC on Base; 10 findings on the broken demo (lc_9b00787167ca2371f7ac07a3); 6 of 10 resolved on the follow-up (lc_KpScNuw45vmP). It is a dramatised sketch, not a screen recording.
- `npx hyperframes check`: ok, 0 errors. Audio measured, not heard: -14.0 LUFS, -1.0 dBFS peak.
