// src/domain/users/userTypes.ts

// User record returned from DB/API
export interface UserDTO {
  UserID: number
  FirstName: string | null
  LastName: string | null
  Email: string | null
  RoleID: number | null
  ProfilePic: string | null
  IsActive: boolean
  CreatedAt: string
  UpdatedAt: string
}

// Payload for creating a new user
export interface CreateUserInput {
  FirstName?: string
  LastName?: string
  Email: string
  Password: string           // required on create
  RoleID?: number | null
  ProfilePic?: string | null
  IsActive?: boolean
}

// Payload for updating an existing user
export interface UpdateUserInput {
  FirstName?: string | null
  LastName?: string | null
  Email?: string | null
  Password?: string          // optional; if present → rehash logic in service
  RoleID?: number | null
  ProfilePic?: string | null
  IsActive?: boolean
}
