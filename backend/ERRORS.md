# Backend - All Errors and Issues

**Generated:** $(date)  
**Project:** Waypool Backend  
**Total Issues:** 8 TypeScript Configuration Errors

---

## 🔴 TypeScript Configuration Errors (8)

### Issue: Scripts Not Under rootDir

**Severity:** Error  
**Type:** TypeScript Configuration  
**Status:** ⚠️ Needs Fix

All scripts in the `scripts/` directory are causing TypeScript errors because they are not under the `rootDir` specified in `tsconfig.json`.

#### Affected Files:

1. **`scripts/check-earnings-data.ts`**

   - Error: File is not under 'rootDir' '/Users/pd-patel/Desktop/waypool/Waypool/backend/src'
   - RootDir is expected to contain all source files

2. **`scripts/check-test-users.ts`**

   - Error: File is not under 'rootDir' '/Users/pd-patel/Desktop/waypool/Waypool/backend/src'
   - RootDir is expected to contain all source files

3. **`scripts/clear-data.ts`**

   - Error: File is not under 'rootDir' '/Users/pd-patel/Desktop/waypool/Waypool/backend/src'
   - RootDir is expected to contain all source files

4. **`scripts/create-test-user.ts`**

   - Error: File is not under 'rootDir' '/Users/pd-patel/Desktop/waypool/Waypool/backend/src'
   - RootDir is expected to contain all source files

5. **`scripts/fix-available-seats.ts`**

   - Error: File is not under 'rootDir' '/Users/pd-patel/Desktop/waypool/Waypool/backend/src'
   - RootDir is expected to contain all source files

6. **`scripts/fix-seats-confirmed-only.ts`**

   - Error: File is not under 'rootDir' '/Users/pd-patel/Desktop/waypool/Waypool/backend/src'
   - RootDir is expected to contain all source files

7. **`scripts/test-earnings-api.ts`**

   - Error: File is not under 'rootDir' '/Users/pd-patel/Desktop/waypool/Waypool/backend/src'
   - RootDir is expected to contain all source files

8. **`scripts/update-total-seats.ts`**
   - Error: File is not under 'rootDir' '/Users/pd-patel/Desktop/waypool/Waypool/backend/src'
   - RootDir is expected to contain all source files

#### Root Cause:

The `tsconfig.json` file has `rootDir` set to `./src`, but the scripts are located in `./scripts/`, which is outside this directory.

#### Solutions:

**Option 1: Exclude scripts from TypeScript compilation (Recommended)**

```json
{
  "exclude": ["node_modules", "dist", "prisma.config.ts", "scripts"],
  "compilerOptions": {
    "rootDir": "src"
  }
}
```

**Current tsconfig.json exclude array:**

```json
"exclude": ["node_modules", "dist", "prisma.config.ts"]
```

**Fix:** Add `"scripts"` to the exclude array.

**Option 2: Move scripts to src directory**

- Move all scripts from `scripts/` to `src/scripts/`
- Update any import paths that reference these scripts

**Option 3: Create separate tsconfig for scripts**

- Create `tsconfig.scripts.json` with different rootDir
- Run scripts with: `tsc --project tsconfig.scripts.json`

#### Recommended Fix:

Add `scripts` to the `exclude` array in `tsconfig.json` since these are utility scripts that don't need to be part of the main compilation.

---

## 📋 Summary

| Category                      | Count | Status               |
| ----------------------------- | ----- | -------------------- |
| TypeScript Config Errors      | 8     | ⚠️ Needs Fix         |
| TypeScript Compilation Errors | 0     | ✅ None              |
| Runtime Errors                | 0     | ✅ None (not tested) |
| **Total**                     | **8** | **⚠️ 8 Issues**      |

---

## 🔧 Recommended Actions

1. **Immediate:** Update `tsconfig.json` to exclude the `scripts/` directory
2. **Optional:** Consider creating a separate TypeScript configuration for scripts if they need type checking
3. **Future:** Review script organization and consider if they should be part of the main codebase or separate utilities

---

## 📝 Notes

- These errors do not affect runtime functionality
- Scripts can still be executed with `ts-node` or `node` directly
- The errors only appear when running `tsc --noEmit` for type checking
- Main application code in `src/` is not affected
