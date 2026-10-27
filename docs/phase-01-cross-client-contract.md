# Phase 01 – cross-client contract (for the Flutter app)

No backend or API change. Web derives presentation from the existing `Post`:
- `type === "listing"` or `listing != null` -> marketplace presentation
- any video media (or `video_url`) -> reel presentation
- any image media -> image / carousel presentation
- otherwise caption-only -> text presentation (posts with no media and no caption are skipped)

Surfaces share ONE feed session (`/feed?scope=...`, `/feed-public`) and one engagement state.
Home -> Immersive hand-off keeps post identity (`post.id`); engagement is read from the viewer's own actions, never copied.

Not available from the backend yet (so not rendered): author verified flag, document / poll / editorial / announcement types.
