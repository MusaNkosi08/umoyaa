# UMOYA

UMOYA is a patient study assistant for South African Grade 12 learners. It
helps students work through Mathematics and Physical Science questions step by
step, including questions written in English, isiXhosa, and other South
African languages. Students can type a question or attach a photo of their
work for the app to read and explain.

## The problem it solves

Many South African learners have limited access to affordable, one-on-one
academic support, especially outside school hours and in communities where
resources are constrained. Language differences can make existing digital
learning tools harder to use. UMOYA provides accessible, curriculum-focused
guidance in familiar language, helping learners understand the method rather
than only receiving an answer.

## How to run the app

### Requirements

- Node.js 18 or later
- A GitHub Models personal access token for AI text and image responses

### Start locally

```bash
cd musankosi08-probable-guide
export GITHUB_TOKEN="your-github-token"
node server.js
```

Open [http://localhost:3000](http://localhost:3000) in a browser. To use a
different port, set `PORT`, for example:

```bash
PORT=3001 GITHUB_TOKEN="your-github-token" node server.js
```

Never commit or share your token. If it is exposed, revoke it and create a
replacement.

## Keeping token usage low

- The server sends only the latest six conversation messages.
- User messages are limited to 600 characters before they reach the model.
- Responses are capped at 500 tokens, with deterministic local fallback answers when the API is unavailable.