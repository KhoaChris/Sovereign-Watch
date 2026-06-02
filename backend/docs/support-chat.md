# Support Chat Flow

## Collections

- `supportPresence/admin`: admin online heartbeat.
- `supportConversations/{userId}`: one support thread per authenticated user.
- `supportConversations/{userId}/messages/{messageId}`: persisted chat history.

## Runtime Flow

1. Frontend authenticates through the existing REST/Firebase flow.
2. Frontend requests `POST /api/auth/firebase-token`.
3. Backend returns a Firebase custom token with `role`.
4. Frontend signs into Firebase client SDK with that token.
5. User/admin panels subscribe to Firestore with `onSnapshot`.
6. If admin heartbeat is fresh, user messages route as human support.
7. If admin heartbeat is stale, the frontend appends a basic bot reply.

## Firestore Rules Draft

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return signedIn() && request.auth.token.role == 'admin';
    }

    function ownsConversation(userId) {
      return signedIn() && request.auth.uid == userId;
    }

    match /supportPresence/admin {
      allow read: if signedIn();
      allow write: if isAdmin();
    }

    match /supportConversations/{userId} {
      allow read, create, update: if isAdmin() || ownsConversation(userId);
      allow delete: if false;

      match /messages/{messageId} {
        allow read, create: if isAdmin() || ownsConversation(userId);
        allow update, delete: if false;
      }
    }
  }
}
```
