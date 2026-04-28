# Source Workspace Compile Design

## Goal

Fix the guided-ingest workspace send interaction and add a one-click action that combines the current source material with the guided-ingest conversation, writes that combined content as a new compile input, and starts the existing compile flow.

## Decisions

1. Keep the existing source material immutable.
   The compile action writes a new markdown file under `inbox/source-gallery-guided-ingest/` instead of appending guided-ingest notes back into the original raw or `sources_full` file.

2. Reuse the existing compile runner.
   The server starts the current `sync` run through the existing run manager instead of creating a separate compile path.

3. Keep the workspace feedback minimal.
   After the compile action is triggered, the workspace only shows a status message that compile has started. It does not open a new progress view.

## Frontend

- Add an explicit send button click handler instead of relying only on form submit.
- Disable the textarea and action buttons while send/compile requests are in flight.
- Add a secondary button labeled `结合对话进入 Compile`.
- Call `POST /api/source-gallery/:id/compile` with the current `conversationId`.

## Backend

- Add `POST /api/source-gallery/:id/compile`.
- Read the source detail and conversation from existing storage.
- Generate a new markdown file that contains:
  - source metadata
  - original source content
  - the guided-ingest conversation transcript
- Store the file in `inbox/source-gallery-guided-ingest/`.
- Start the existing `sync` run with the run manager and return the generated input path plus run id.

## Testing

- Frontend test: clicking the workspace compile button calls the new endpoint and surfaces a compile status message.
- Route test: the compile endpoint writes a combined input file containing both source content and conversation messages, then starts a sync run.
