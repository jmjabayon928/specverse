// src/backend/controllers/rolesController.ts
import type { RequestHandler } from 'express'
import { asSingleString, parseIntParam } from '../utils/requestParam'
import {
  listRoles as svcList,
  getRoleById as svcGet,
  createRole as svcCreate,
  updateRole as svcUpdate,
  deleteRole as svcDelete,
  listRolePermissions as svcListRolePerms,
  listAvailablePermissionsForRole as svcListAvail,
  addPermissionToRole as svcAddPerm,
  removePermissionFromRole as svcRemovePerm,
  type ListRolesResult,
} from '../services/rolesService'

/**
 * GET /api/backend/settings/roles
 * Supports pagination and optional search.
 */
export const listRoles: RequestHandler = async (req, res) => {
  try {
    const pageQueryRaw = asSingleString(req.query.page as string | string[] | undefined)
    const pageSizeQueryRaw = asSingleString(req.query.pageSize as string | string[] | undefined)
    const searchQueryRaw = asSingleString(req.query.search as string | string[] | undefined)

    const parsedPage = pageQueryRaw === undefined ? 1 : Number.parseInt(pageQueryRaw, 10)
    const page = Math.max(Number.isFinite(parsedPage) ? parsedPage : 1, 1)

    const parsedPageSize =
      pageSizeQueryRaw === undefined ? 20 : Number.parseInt(pageSizeQueryRaw, 10)
    const rawPageSize = Number.isFinite(parsedPageSize) ? parsedPageSize : 20
    const pageSize = Math.min(Math.max(rawPageSize, 1), 100)

    const search = (searchQueryRaw ?? '').trim()

    const out: ListRolesResult = await svcList({ page, pageSize, search })
    res.json(out)
  } catch (err) {
    console.error('listRoles error:', err)
    res.status(500).json({ error: 'Failed to fetch roles' })
  }
}

/**
 * GET /api/backend/settings/roles/:id
 * Returns a single role row or 404.
 */
export const getRole: RequestHandler = async (req, res) => {
  try {
    const id = parseIntParam(req.params.id)
    if (id == null) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const row = await svcGet(id)
    if (!row) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    res.json(row)
  } catch (err) {
    console.error('getRole error:', err)
    res.status(500).json({ error: 'Failed to fetch role' })
  }
}

/**
 * POST /api/backend/settings/roles
 * Creates a new role and returns its RoleID.
 */
export const createRole: RequestHandler = async (req, res) => {
  try {
    const body = (req.body ?? {}) as { RoleName?: string | null }
    const rawRoleName = body.RoleName ?? null
    const trimmedRoleName = rawRoleName?.trim() ?? ''

    if (trimmedRoleName.length === 0) {
      res.status(400).json({ error: 'RoleName is required' })
      return
    }

    const newId = await svcCreate({ RoleName: trimmedRoleName })
    res.status(201).json({ RoleID: newId })
  } catch (err: unknown) {
    const e = err as Error

    if (e.name === 'ROLENAME_CONFLICT') {
      res.status(409).json({ error: 'RoleName already exists' })
      return
    }

    console.error('createRole error:', err)
    res.status(500).json({ error: 'Failed to create role' })
  }
}

/**
 * PATCH /api/backend/settings/roles/:id
 * Updates role name. Returns { ok: true } or 404.
 */
export const updateRole: RequestHandler = async (req, res) => {
  try {
    const id = parseIntParam(req.params.id)
    if (id == null) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const body = (req.body ?? {}) as { RoleName?: string | null }
    const roleName = body.RoleName ?? null

    const ok = await svcUpdate(id, { RoleName: roleName })

    if (!ok) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    res.json({ ok: true })
  } catch (err: unknown) {
    const e = err as Error

    if (e.name === 'ROLENAME_CONFLICT') {
      res.status(409).json({ error: 'RoleName already exists' })
      return
    }

    console.error('updateRole error:', err)
    res.status(500).json({ error: 'Failed to update role' })
  }
}

/**
 * DELETE /api/backend/settings/roles/:id
 * Deletes a role. Returns { ok: true } or 404.
 */
export const deleteRole: RequestHandler = async (req, res) => {
  try {
    const id = parseIntParam(req.params.id)
    if (id == null) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const ok = await svcDelete(id)

    if (!ok) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('deleteRole error:', err)
    res.status(500).json({ error: 'Failed to delete role' })
  }
}

/**
 * GET /api/backend/settings/roles/:id/permissions
 * Returns role plus its assigned permissions.
 */
export const getRolePermissions: RequestHandler = async (req, res) => {
  try {
    const id = parseIntParam(req.params.id)
    if (id == null) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const role = await svcGet(id)
    if (!role) {
      res.status(404).json({ error: 'Role not found' })
      return
    }

    const permissions = await svcListRolePerms(id)
    res.json({ role, permissions })
  } catch (err) {
    console.error('getRolePermissions error:', err)
    res.status(500).json({ error: 'Failed to fetch role permissions' })
  }
}

/**
 * GET /api/backend/settings/roles/:id/permissions/available
 * Returns permissions that are not yet assigned to this role.
 */
export const getRoleAvailablePermissions: RequestHandler = async (req, res) => {
  try {
    const id = parseIntParam(req.params.id)
    if (id == null) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const permissions = await svcListAvail(id)
    res.json(permissions)
  } catch (err) {
    console.error('getRoleAvailablePermissions error:', err)
    res.status(500).json({ error: 'Failed to fetch available permissions' })
  }
}

/**
 * POST /api/backend/settings/roles/:id/permissions
 * Body: { PermissionID }
 * Adds a permission to a role.
 */
export const addPermissionToRole: RequestHandler = async (req, res) => {
  try {
    const id = parseIntParam(req.params.id)
    if (id == null) {
      res.status(400).json({ error: 'Invalid ids' })
      return
    }

    const body = (req.body ?? {}) as { PermissionID?: number }
    const permissionIdRaw = body.PermissionID
    const permissionId =
      typeof permissionIdRaw === 'number' ? permissionIdRaw : Number.NaN

    if (!Number.isFinite(permissionId)) {
      res.status(400).json({ error: 'Invalid ids' })
      return
    }

    const ok = await svcAddPerm(id, permissionId)

    if (!ok) {
      res
        .status(409)
        .json({ error: 'Permission already assigned or invalid' })
      return
    }

    res.status(201).json({ ok: true })
  } catch (err) {
    console.error('addPermissionToRole error:', err)
    res.status(500).json({ error: 'Failed to add permission' })
  }
}

/**
 * DELETE /api/backend/settings/roles/:id/permissions/:permissionId
 * Removes a permission from a role.
 */
export const removePermissionFromRole: RequestHandler = async (req, res) => {
  try {
    const id = parseIntParam(req.params.id)
    const permissionId = parseIntParam(req.params.permissionId)

    if (id == null || permissionId == null) {
      res.status(400).json({ error: 'Invalid ids' })
      return
    }

    const ok = await svcRemovePerm(id, permissionId)

    if (!ok) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('removePermissionFromRole error:', err)
    res.status(500).json({ error: 'Failed to remove permission' })
  }
}
