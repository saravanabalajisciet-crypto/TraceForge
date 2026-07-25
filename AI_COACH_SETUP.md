# AI Investigation Coach Setup

The AI Investigation Coach is powered by Google Gemini and provides educational guidance during DFIR investigations.

## Prerequisites

- Google Gemini API key (free tier available)
- Node.js 18+ and npm

## Setup Instructions

### 1. Get your Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` and add your API key:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```

3. **Never commit `.env.local` to version control**

### 3. Restart the Development Server

```bash
npm run dev
```

The AI Coach will now be active in the investigation workspace.

## Features

The AI Coach supports four actions:

### 1. **Need a Hint**
- Provides investigative guidance without revealing answers
- Suggests which types of evidence to look for
- Explains forensic concepts relevant to the scenario

### 2. **Explain this Evidence**
- Analyzes the currently selected evidence item
- Explains what the evidence means forensically
- Identifies related MITRE ATT&CK tactics/techniques
- Suggests correlated evidence to investigate

### 3. **What should I investigate next?**
- Analyzes your current timeline and progress
- Recommends investigation directions
- Identifies coverage gaps in MITRE tactics
- Encourages evidence correlation

### 4. **Explain My Mistakes** (Post-Investigation)
- Available after clicking "Reveal Investigation"
- Explains forensic concepts you may have missed
- Teaches attack chain progression
- Provides educational feedback on your approach

## How It Works

### Architecture

```
Investigation Page
       ↓
    AICoach Component (Frontend)
       ↓
    /api/coach Route (Server-side)
       ↓
    geminiCoach.ts (Gemini Service)
       ↓
    Google Gemini API
```

### Security

- ✅ API key stored in environment variables (server-side only)
- ✅ Never exposed to frontend/client bundle
- ✅ Input validation on all requests
- ✅ Graceful error handling
- ✅ .env files excluded from version control

### Prompt Engineering

The AI is instructed to:
- **Never reveal the correct timeline order**
- **Never reveal hidden evidence**
- **Never solve the investigation**
- Always guide through questions
- Always explain forensic concepts
- Always reference MITRE ATT&CK when relevant

The system prompt enforces "Senior DFIR Mentor" behavior, not generic ChatGPT responses.

## Troubleshooting

### "AI Mentor is currently unavailable"

**Possible causes:**
1. Missing or invalid `GEMINI_API_KEY` in `.env.local`
2. API quota exceeded (check [Google AI Studio](https://makersuite.google.com/))
3. Network connectivity issues

**Solution:**
1. Verify your `.env.local` file exists and contains a valid key
2. Restart the dev server: `npm run dev`
3. Check the terminal for error messages

### API Rate Limits

Gemini free tier includes:
- 15 requests per minute
- 1,500 requests per day

If you hit rate limits, wait 60 seconds and try again.

### TypeScript Errors

If you see module resolution errors:
1. Restart the TypeScript server in your IDE
2. Run `npx tsc --noEmit` to verify compilation
3. Delete `.next` folder and restart: `rm -rf .next && npm run dev`

## Cost Information

- **Free Tier**: 15 RPM, 1,500 RPD, 1 million tokens/month
- **Pay-as-you-go**: $0.075 per 1M input tokens, $0.30 per 1M output tokens

Typical investigation session uses ~2,000-4,000 tokens, well within free tier limits.

## Production Deployment

When deploying to production (Vercel, AWS, etc.):

1. Add `GEMINI_API_KEY` to your platform's environment variable settings
2. Never commit `.env.local` or `.env.production`
3. Use platform secrets management (Vercel Secrets, AWS Secrets Manager, etc.)
4. Monitor API usage in [Google AI Studio](https://makersuite.google.com/)

## Development Notes

### File Structure

```
src/
├── app/
│   └── api/
│       └── coach/
│           └── route.ts          # Server-side API route
├── lib/
│   └── geminiCoach.ts            # Gemini service (server-only)
└── components/
    └── features/
        └── coach/
            └── AICoach.tsx        # Frontend component
```

### Adding New Coach Actions

To add a new coach action:

1. Add action type to `CoachActionType` in `geminiCoach.ts`
2. Create a new prompt builder function
3. Add case to `coachRequest()` switch statement
4. Update `AICoach.tsx` to add UI button
5. Update validation in `route.ts`

### Testing

Test each action manually:

```bash
# Start dev server
npm run dev

# Navigate to investigation page
# http://localhost:3000/investigation?id=shadowlock

# Test each button:
# - Need a Hint
# - Explain this Evidence (select an evidence card first)
# - What should I investigate next?
# - Complete investigation and click "Reveal Investigation"
# - Click "Explain My Mistakes"
```

## Support

For issues or questions:
1. Check console for error messages (F12 in browser)
2. Verify API key is valid in [Google AI Studio](https://makersuite.google.com/)
3. Review terminal output for server errors
4. Ensure `.env.local` exists and is not `.gitignore`d

---

**Status**: ✅ Production Ready
**Last Updated**: July 25, 2026
