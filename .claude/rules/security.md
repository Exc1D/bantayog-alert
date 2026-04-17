# Security Rules

Security best practices for frontend and Firebase applications.
Reference: [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Authentication & Authorization

### Rules

- Never store credentials in client-side code
- Use Firebase Auth for all authentication
- Validate ID tokens on backend/cloud functions
- Implement least-privilege access
- Always check `request.auth` in Firestore rules
- Use short-lived tokens

### Firebase Auth

```javascript
// CORRECT: Verify token server-side
const decodedToken = await admin.auth().verifyIdToken(idToken)
const uid = decodedToken.uid

// NEVER: Trust client-side user data
const userData = { uid: localStorage.getItem('userId') }
```

## Data Validation

### Rules

- Validate all user input on server-side
- Use type-safe validation (Zod, Yup, etc.)
- Sanitize data before rendering
- Escape HTML to prevent XSS
- Validate file uploads
- Use parameterized queries (never string concatenation)

### XSS Prevention

```typescript
// CORRECT: Sanitize before rendering
import DOMPurify from 'dompurify'
const sanitized = DOMPurify.sanitize(userInput)

// NEVER: Insert raw user input
element.innerHTML = userInput

// Template literals are safe for text content
const displayName = `<span>${escape(userName)}</span>`
```

### SQL/NoSQL Injection

```typescript
// CORRECT: Parameterized query
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId])

// CORRECT: Firestore - use document IDs, not user input in paths
const doc = await db.collection('users').doc(sanitizeId(userId)).get()

// NEVER: String concatenation in queries
const user = await db.query(`SELECT * FROM users WHERE id = ${userId}`)
```

## Secrets Management

### Rules

- Never commit secrets, API keys, or credentials
- Use environment variables for configuration
- Use Firebase Security Rules for data access
- Rotate exposed credentials immediately
- Use `.env.example` as template (never with real values)
- Audit secret access via logs

### Environment Variables

```bash
# .env (never commit)
API_KEY=actual_secret_key
DATABASE_URL=https://...
FIREBASE_CONFIG={"type":"service_account"...}

# .env.example (commit this)
API_KEY=
DATABASE_URL=
FIREBASE_CONFIG=
```

## Firestore Security Rules

### Rules

- Default deny: no access unless explicitly granted
- Validate all data writes
- Check `request.auth` for authenticated operations
- Use `match` for precise path targeting
- Test rules with Firebase Emulator
- Never trust `request.resource.data` without validation
- Use `get()` to fetch related documents for authorization

### Example Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    function isValidUserData() {
      let data = request.resource.data;
      return data.keys().hasAll(['email', 'createdAt'])
             && data.email is string
             && data.email.size() <= 254;
    }

    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated()
                    && isOwner(userId)
                    && isValidUserData();
      allow update: if isOwner(userId);
      allow delete: if isOwner(userId);
    }

    match /alerts/{alertId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated()
                             && resource.data.createdBy == request.auth.uid;
    }
  }
}
```

## Input Validation

### Rules

- Validate on both client and server
- Use allowlists/regex for strict validation
- Limit string lengths
- Validate types strictly (no `any`)
- Use TypeScript strict mode
- Sanitize file uploads (check MIME type, scan for malware)

### Example Validation

```typescript
import { z } from 'zod'

const ContactSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z\s]*$/),
  email: z.string().email().max(254),
  message: z.string().max(1000),
})

type Contact = z.infer<typeof ContactSchema>
```

## CORS (Cross-Origin Resource Sharing)

### Rules

- Configure CORS on backend services
- Allow only trusted origins
- Use specific origins, not `*` for credentials
- Implement CSRF tokens for state-changing operations

### Firebase Functions CORS

```javascript
const cors = require('cors')({
  origin: ['https://yourapp.firebaseapp.com', 'https://yourapp.com'],
  credentials: true,
})

exports.api = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    // Handle request
  })
})
```

## CSRF (Cross-Site Request Forgery)

### Rules

- Use Anti-CSRF tokens for forms
- Validate `Origin` or `Referer` headers
- Use SameSite cookies
- Implement CSRF protection in Firebase Functions

### SameSite Cookies

```javascript
// In Firebase Functions
res.cookie('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
})
```

## Dependency Security

### Rules

- Regularly update dependencies
- Use `npm audit` to find vulnerabilities
- Review `package.json` for untrusted packages
- Lock file versions in production
- Use `--save-exact` for reproducible builds
- Enable GitHub Dependabot

### Commands

```bash
npm audit          # Check for vulnerabilities
npm audit fix     # Auto-fix some issues
npm outdated      # Check outdated packages
npm fund          # Check for deprecated packages
```

### Dependency Review Checklist

- [ ] Check package popularity and maintenance
- [ ] Review changelog for security fixes
- [ ] Check for known vulnerabilities (npm audit)
- [ ] Verify no hidden network calls
- [ ] Review bundle size impact

## Security Headers

### Recommended Headers

```javascript
// Firebase Hosting headers in firebase.json
{
  "hosting": {
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
          { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" },
          { "key": "X-Frame-Options", "value": "DENY" },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
        ]
      }
    ]
  }
}
```

## Logging & Monitoring

### Rules

- Log security events (failed auth, rate limits)
- Never log sensitive data (passwords, tokens, PII)
- Use structured logging
- Set up alerts for suspicious activity
- Regular security audits

### What to Log

| Event              | Level | Data                      |
| ------------------ | ----- | ------------------------- |
| Failed login       | WARN  | timestamp, email, IP      |
| Rate limit hit     | INFO  | timestamp, endpoint, IP   |
| Auth token refresh | DEBUG | userId, timestamp         |
| Admin action       | INFO  | userId, action, timestamp |

### What NOT to Log

- Passwords or hashed passwords
- API keys or tokens
- Full credit card numbers
- Social Security Numbers
- Medical information

## OWASP Top 10 (Priority Awareness)

| #   | Risk                      | Mitigation                              |
| --- | ------------------------- | --------------------------------------- |
| A01 | Broken Access Control     | Validate permissions server-side        |
| A02 | Cryptographic Failures    | Use Firebase Auth, HTTPS only           |
| A03 | Injection                 | Parameterized queries, input validation |
| A04 | Insecure Design           | Threat modeling, secure defaults        |
| A05 | Security Misconfiguration | Hardened headers, minimal permissions   |
| A06 | Vulnerable Components     | Regular updates, npm audit              |
| A07 | Auth Failures             | Firebase Auth, short-lived tokens       |
| A08 | Data Integrity Failures   | Firestore rules, input validation       |
| A09 | Logging Failures          | Structured logging, alerts              |
| A10 | SSRF                      | Validate URLs, block internal IPs       |

## Incident Response

### If a breach is suspected:

1. Rotate all credentials immediately
2. Review access logs for scope
3. Assess data exposure
4. Isolate affected systems
5. Notify affected users (within 72 hours per GDPR)
6. Document the incident
7. Implement fixes
8. Post-mortem analysis

### Emergency Contacts

- Firebase Support: [Firebase Support](https://firebase.google.com/support)
- Report vulnerabilities: [Google VRP](https://bughunter.withgoogle.com/)
