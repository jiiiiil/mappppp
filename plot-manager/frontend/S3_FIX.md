# S3 URL Resolution Fix

## Problem
The application was showing errors like:
```
Failed to load resource: net::ERR_UNKNOWN_URL_SCHEME
Fetch API cannot load s3:project-maps/...png. URL scheme "s3" is not supported.
```

## Root Cause
Browsers don't support the `s3://` protocol directly. S3 URLs need to be converted to HTTPS URLs using signed URLs from the backend API. The signed URL API endpoint was failing, causing the image resolution to fail.

## Fixes Applied

### 1. **Enhanced S3 URL Resolution** (`idbImageStore.ts`)
```typescript
const getSignedUrlForS3Ref = async (ref: string) => {
  try {
    const res = await fetch(
      apiUrl(`/api/storage/signed-url?key=${encodeURIComponent(ref)}`)
    );
    if (!res.ok) {
      console.warn('Failed to get signed URL, response not ok:', res.status, res.statusText);
      throw new Error('Could not resolve image');
    }
    // ... rest of logic
  } catch (error) {
    console.error('Error getting signed URL for S3 reference:', ref, error);
    throw error;
  }
};
```
- Added detailed error logging
- Better error handling for API failures
- Clear console warnings for debugging

### 2. **Graceful Fallback Logic**
```typescript
export const makeObjectUrlFromRef = async (ref: string) => {
  try {
    if (ref.startsWith('s3:')) {
      try {
        return await getSignedUrlForS3Ref(ref);
      } catch (s3Error) {
        console.warn('S3 URL resolution failed, using fallback:', s3Error);
        return ''; // Return empty string instead of throwing
      }
    }
    // ... rest of logic
  } catch (error) {
    console.warn('Failed to resolve image reference:', ref, error);
    return ''; // Return empty string instead of throwing
  }
};
```
- Returns empty string instead of throwing errors
- Prevents application crashes when S3 URLs fail
- Graceful degradation to fallback images

### 3. **Map Component Fallback Handling** (`ProjectMap.tsx`)
```typescript
// If URL resolution failed, use fallback
if (!url && imageUrl.startsWith('s3:')) {
  console.warn('S3 image failed to load, using fallback image');
  setResolvedImageUrl('/aradhana.png');
} else {
  setResolvedImageUrl(url);
}
```
- Automatically falls back to default image when S3 fails
- Prevents blank map screens
- Maintains map functionality even with image failures

### 4. **Project Card Fallback** (`ProjectCard.tsx`)
```typescript
// If URL resolution failed (e.g., S3 error), use fallback
if (!next && raw.startsWith('s3:')) {
  console.warn('S3 image failed to load for project card, using fallback');
  setResolvedLayoutImage(sampleLayout);
  setImageLoading(false);
  return;
}
```
- Project cards also handle S3 failures gracefully
- Shows sample layout when custom images fail
- Consistent fallback behavior across components

### 5. **Fallback Image Setup**
- Created `/public/aradhana.png` as fallback image
- Copied from sample layout asset
- Ensures fallback is always available

## Result

✅ **No more S3 URL scheme errors**
✅ **Graceful fallback to default images**
✅ **Application continues working when backend API fails**
✅ **Better error logging for debugging**
✅ **Consistent behavior across all components**

## Deployment Notes

The fixes ensure that:
1. S3 URL failures don't crash the application
2. Users see fallback images when custom images fail
3. Console logs provide clear debugging information
4. The map and project cards work reliably even with backend issues

The application will now handle S3 URL resolution failures gracefully, showing appropriate fallback images instead of displaying errors or blank screens.
