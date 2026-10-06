# Mean Chess

**Chess, but your king is allowed to eat his own army.**

Mean Chess is an independent chess variant. It is standard chess plus two mechanics:

- **Royal Capture / Royal Slaughter.** Only a king can capture a king, and it can do so from exactly two
  squares away along a rank, file or diagonal, even eating its own eligible piece in between.
- **Royal Cannibalism.** A king that would otherwise be lost may sacrifice an adjacent piece of its own,
  following a strict hierarchy: pawns first, then knights and bishops, then rooks, then promoted queens.
  The original queen can never be sacrificed.

**Status:** under construction (v0.1). It will be playable at https://meanchess.siddheshthapa.com.

- Build plan and the draft rules specification: [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md)
- Original founder brief: [`docs/archive/HANDOFF-v0.md`](docs/archive/HANDOFF-v0.md)

Licence: [MIT](LICENSE).
