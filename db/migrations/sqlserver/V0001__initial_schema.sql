/****** Object:  Sequence [dbo].[AuditLogIdSeq]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE SEQUENCE [dbo].[AuditLogIdSeq] 
 AS [int]
 START WITH 19
 INCREMENT BY 1
 MINVALUE -2147483648
 MAXVALUE 2147483647
 CACHE 
GO
/****** Object:  Sequence [dbo].[Seq_Clients]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE SEQUENCE [dbo].[Seq_Clients] 
 AS [int]
 START WITH 1
 INCREMENT BY 1
 MINVALUE -2147483648
 MAXVALUE 2147483647
 CACHE 
GO
/****** Object:  Sequence [dbo].[Seq_Manufacturers]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE SEQUENCE [dbo].[Seq_Manufacturers] 
 AS [int]
 START WITH 1
 INCREMENT BY 1
 MINVALUE -2147483648
 MAXVALUE 2147483647
 CACHE 
GO
/****** Object:  Sequence [dbo].[Seq_Permissions]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE SEQUENCE [dbo].[Seq_Permissions] 
 AS [int]
 START WITH 1
 INCREMENT BY 1
 MINVALUE -2147483648
 MAXVALUE 2147483647
 CACHE 
GO
/****** Object:  Sequence [dbo].[Seq_Projects]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE SEQUENCE [dbo].[Seq_Projects] 
 AS [int]
 START WITH 1
 INCREMENT BY 1
 MINVALUE -2147483648
 MAXVALUE 2147483647
 CACHE 
GO
/****** Object:  Sequence [dbo].[Seq_Roles]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE SEQUENCE [dbo].[Seq_Roles] 
 AS [int]
 START WITH 1
 INCREMENT BY 1
 MINVALUE -2147483648
 MAXVALUE 2147483647
 CACHE 
GO
/****** Object:  Sequence [dbo].[Seq_Suppliers]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE SEQUENCE [dbo].[Seq_Suppliers] 
 AS [int]
 START WITH 1
 INCREMENT BY 1
 MINVALUE -2147483648
 MAXVALUE 2147483647
 CACHE 
GO
/****** Object:  Sequence [dbo].[Seq_Users]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE SEQUENCE [dbo].[Seq_Users] 
 AS [int]
 START WITH 1
 INCREMENT BY 1
 MINVALUE -2147483648
 MAXVALUE 2147483647
 CACHE 
GO
/****** Object:  Table [dbo].[AccountInvites]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AccountInvites](
	[InviteID] [int] IDENTITY(1,1) NOT NULL,
	[AccountID] [int] NOT NULL,
	[Email] [nvarchar](255) NOT NULL,
	[RoleID] [int] NOT NULL,
	[TokenHash] [char](64) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[ExpiresAt] [datetime2](0) NOT NULL,
	[InvitedByUserID] [int] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[AcceptedByUserID] [int] NULL,
	[AcceptedAt] [datetime2](0) NULL,
	[RevokedByUserID] [int] NULL,
	[RevokedAt] [datetime2](0) NULL,
	[SendCount] [int] NOT NULL,
	[LastSentAt] [datetime2](0) NULL,
 CONSTRAINT [PK_AccountInvites] PRIMARY KEY CLUSTERED 
(
	[InviteID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AccountMembers]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AccountMembers](
	[AccountMemberID] [int] IDENTITY(1,1) NOT NULL,
	[AccountID] [int] NOT NULL,
	[UserID] [int] NOT NULL,
	[RoleID] [int] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[IsOwner] [bit] NOT NULL,
 CONSTRAINT [PK_AccountMembers] PRIMARY KEY CLUSTERED 
(
	[AccountMemberID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_AccountMembers_AccountID_UserID] UNIQUE NONCLUSTERED 
(
	[AccountID] ASC,
	[UserID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AccountOwnershipTransfers]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AccountOwnershipTransfers](
	[TransferID] [int] IDENTITY(1,1) NOT NULL,
	[AccountID] [int] NOT NULL,
	[FromUserID] [int] NOT NULL,
	[ToUserID] [int] NOT NULL,
	[RequestedByUserID] [int] NOT NULL,
	[Reason] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](3) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[TransferID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Accounts]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Accounts](
	[AccountID] [int] IDENTITY(1,1) NOT NULL,
	[AccountName] [nvarchar](255) NOT NULL,
	[Slug] [nvarchar](64) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[OwnerUserID] [int] NULL,
 CONSTRAINT [PK_Accounts] PRIMARY KEY CLUSTERED 
(
	[AccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Accounts_Slug] UNIQUE NONCLUSTERED 
(
	[Slug] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Actions]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Actions](
	[ActionID] [int] NOT NULL,
	[ActionName] [varchar](75) NOT NULL,
	[ActionDesc] [varchar](150) NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AIPredictions]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AIPredictions](
	[PredictionID] [int] NOT NULL,
	[SheetID] [int] NOT NULL,
	[PredictionType] [varchar](50) NULL,
	[PredictionValue] [varchar](255) NULL,
	[PredictionDate] [datetime] NULL,
	[ModelVersion] [varchar](50) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Areas]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Areas](
	[AreaID] [int] IDENTITY(1,1) NOT NULL,
	[AreaCode] [varchar](15) NOT NULL,
	[AreaName] [varchar](255) NOT NULL,
	[HeadID] [int] NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[AreaID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Assets]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Assets](
	[AssetID] [int] IDENTITY(1,1) NOT NULL,
	[AssetTag] [nvarchar](80) NOT NULL,
	[AssetName] [nvarchar](200) NULL,
	[DisciplineID] [int] NULL,
	[SubtypeID] [int] NULL,
	[Service] [nvarchar](200) NULL,
	[System] [nvarchar](200) NULL,
	[Location] [nvarchar](200) NULL,
	[Criticality] [varchar](20) NULL,
	[ClientID] [int] NULL,
	[ProjectID] [int] NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[AccountID] [int] NOT NULL,
	[AssetTagNorm] [nvarchar](100) NOT NULL,
 CONSTRAINT [PK_Assets] PRIMARY KEY CLUSTERED 
(
	[AssetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Attachments]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Attachments](
	[AttachmentID] [int] IDENTITY(1,1) NOT NULL,
	[OriginalName] [nvarchar](255) NOT NULL,
	[StoredName] [nvarchar](255) NOT NULL,
	[ContentType] [varchar](120) NOT NULL,
	[FileSizeBytes] [bigint] NOT NULL,
	[StorageProvider] [varchar](30) NOT NULL,
	[StoragePath] [nvarchar](500) NOT NULL,
	[Sha256] [char](64) NULL,
	[UploadedBy] [int] NULL,
	[UploadedAt] [datetime2](0) NOT NULL,
	[Version] [int] NOT NULL,
	[IsViewable]  AS (case when [ContentType] like 'image/%' OR [ContentType]='application/pdf' then (1) else (0) end) PERSISTED NOT NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[AttachmentID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Attachments_StoredName] UNIQUE NONCLUSTERED 
(
	[StoredName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AuditLogs]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AuditLogs](
	[LogID] [int] NOT NULL,
	[TableName] [nvarchar](255) NULL,
	[RecordID] [int] NULL,
	[Action] [nvarchar](50) NULL,
	[PerformedBy] [int] NOT NULL,
	[PerformedAt] [datetime] NULL,
	[Route] [nvarchar](500) NULL,
	[Method] [nvarchar](10) NULL,
	[StatusCode] [int] NULL,
	[Changes] [nvarchar](max) NULL,
	[AccountID] [int] NULL,
 CONSTRAINT [PK_AuditLogs_LogID] PRIMARY KEY CLUSTERED 
(
	[LogID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Categories]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Categories](
	[CategoryID] [int] NOT NULL,
	[CategoryCode] [varchar](20) NOT NULL,
	[CategoryName] [varchar](150) NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ChangeLogs]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ChangeLogs](
	[ChangeLogID] [int] IDENTITY(1,1) NOT NULL,
	[SheetID] [int] NOT NULL,
	[InfoTemplateID] [int] NOT NULL,
	[OldValue] [nvarchar](max) NULL,
	[NewValue] [nvarchar](max) NULL,
	[UOM] [varchar](100) NULL,
	[ChangedBy] [int] NOT NULL,
	[ChangeDate] [datetime2](7) NOT NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[ChangeLogID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Clients]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Clients](
	[ClientID] [int] NOT NULL,
	[ClientCode] [varchar](20) NOT NULL,
	[ClientName] [varchar](150) NOT NULL,
	[ClientEmail] [varchar](150) NOT NULL,
	[ClientPhone] [varchar](150) NOT NULL,
	[ClientAddress] [varchar](150) NOT NULL,
	[ContactPerson] [varchar](150) NOT NULL,
	[ClientLogo] [varchar](150) NOT NULL,
	[CreatedAt] [datetime2](3) NOT NULL,
	[UpdatedAt] [datetime2](3) NOT NULL,
	[AccountID] [int] NULL,
 CONSTRAINT [PK_Clients] PRIMARY KEY CLUSTERED 
(
	[ClientID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Conversions]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Conversions](
	[ConvID] [int] NOT NULL,
	[SiUomCode] [varchar](15) NOT NULL,
	[SiUomName] [varchar](60) NOT NULL,
	[UscUomCode] [varchar](15) NOT NULL,
	[UscUomName] [varchar](60) NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DatasheetLayouts]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DatasheetLayouts](
	[LayoutID] [int] IDENTITY(1,1) NOT NULL,
	[TemplateID] [int] NULL,
	[ClientID] [int] NULL,
	[PaperSize] [nvarchar](16) NOT NULL,
	[Orientation] [nvarchar](16) NOT NULL,
	[GridCols] [int] NOT NULL,
	[GridGapMm] [decimal](9, 2) NOT NULL,
	[MarginTopMm] [decimal](9, 2) NOT NULL,
	[MarginRightMm] [decimal](9, 2) NOT NULL,
	[MarginBottomMm] [decimal](9, 2) NOT NULL,
	[MarginLeftMm] [decimal](9, 2) NOT NULL,
	[ThemeJSON] [nvarchar](max) NULL,
	[LockedHeaderJSON] [nvarchar](max) NULL,
	[LockedFooterJSON] [nvarchar](max) NULL,
	[Version] [int] NOT NULL,
	[IsDefault] [bit] NOT NULL,
	[CreatedBy] [int] NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[LayoutID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DatasheetSubtypes]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DatasheetSubtypes](
	[SubtypeID] [int] IDENTITY(1,1) NOT NULL,
	[DisciplineID] [int] NOT NULL,
	[Code] [varchar](40) NOT NULL,
	[Name] [varchar](150) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_DatasheetSubtypes] PRIMARY KEY CLUSTERED 
(
	[SubtypeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Departments]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Departments](
	[DeptID] [int] NOT NULL,
	[DeptCode] [varchar](20) NOT NULL,
	[DeptName] [varchar](150) NOT NULL,
	[HeadID] [int] NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DisciplinePacks]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DisciplinePacks](
	[PackID] [int] IDENTITY(1,1) NOT NULL,
	[DisciplineID] [int] NOT NULL,
	[PackName] [varchar](150) NOT NULL,
	[Version] [varchar](20) NOT NULL,
	[Status] [varchar](20) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[PackID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DisciplinePackTemplates]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DisciplinePackTemplates](
	[PackID] [int] NOT NULL,
	[TemplateID] [int] NOT NULL,
	[SortOrder] [int] NOT NULL,
	[IsDefault] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[PackID] ASC,
	[TemplateID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Disciplines]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Disciplines](
	[DisciplineID] [int] IDENTITY(1,1) NOT NULL,
	[Code] [varchar](20) NOT NULL,
	[Name] [varchar](100) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_Disciplines] PRIMARY KEY CLUSTERED 
(
	[DisciplineID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EntityLinks]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EntityLinks](
	[LinkID] [bigint] IDENTITY(1,1) NOT NULL,
	[FromEntityType] [varchar](40) NOT NULL,
	[FromEntityID] [nvarchar](64) NOT NULL,
	[ToEntityType] [varchar](40) NOT NULL,
	[ToEntityID] [nvarchar](64) NOT NULL,
	[RelationType] [varchar](40) NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [int] NULL,
 CONSTRAINT [PK_EntityLinks] PRIMARY KEY CLUSTERED 
(
	[LinkID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EstimationChangeLogs]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EstimationChangeLogs](
	[ChangeLogID] [int] IDENTITY(1,1) NOT NULL,
	[EstimationID] [int] NOT NULL,
	[ItemID] [int] NULL,
	[ChangedBy] [int] NOT NULL,
	[ChangedAt] [datetime] NOT NULL,
	[FieldChanged] [nvarchar](255) NOT NULL,
	[OldValue] [nvarchar](max) NULL,
	[NewValue] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[ChangeLogID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EstimationItems]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EstimationItems](
	[EItemID] [int] IDENTITY(1,1) NOT NULL,
	[EstimationID] [int] NOT NULL,
	[PackageID] [int] NULL,
	[ItemID] [int] NOT NULL,
	[Quantity] [decimal](18, 0) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[CreatedAt] [datetime] NOT NULL,
	[CreatedBy] [int] NULL,
	[ModifiedAt] [datetime] NULL,
	[ModifiedBy] [int] NULL,
	[EstimatedUnitCost] [decimal](18, 0) NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[EItemID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EstimationItemSupplierQuotes]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EstimationItemSupplierQuotes](
	[QuoteID] [int] IDENTITY(1,1) NOT NULL,
	[ItemID] [int] NOT NULL,
	[SupplierID] [int] NOT NULL,
	[QuotedUnitCost] [decimal](18, 0) NOT NULL,
	[ExpectedDeliveryDays] [int] NULL,
	[CurrencyCode] [nvarchar](10) NULL,
	[IsSelected] [bit] NOT NULL,
	[Notes] [nvarchar](max) NULL,
	[CreatedAt] [datetime] NOT NULL,
	[CreatedBy] [int] NULL,
	[ModifiedAt] [datetime] NULL,
	[ModifiedBy] [int] NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[QuoteID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EstimationPackages]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EstimationPackages](
	[PackageID] [int] IDENTITY(1,1) NOT NULL,
	[EstimationID] [int] NOT NULL,
	[PackageName] [nvarchar](255) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[Sequence] [int] NOT NULL,
	[TotalMaterialCost] [decimal](18, 0) NULL,
	[TotalLaborCost] [decimal](18, 0) NULL,
	[TotalDurationDays] [int] NULL,
	[CreatedAt] [datetime] NOT NULL,
	[CreatedBy] [int] NULL,
	[ModifiedAt] [datetime] NULL,
	[ModifiedBy] [int] NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[PackageID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Estimations]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Estimations](
	[ClientID] [int] NOT NULL,
	[ProjectID] [int] NOT NULL,
	[Title] [nvarchar](255) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[VerifiedBy] [int] NULL,
	[VerifiedAt] [datetime] NULL,
	[TotalMaterialCost] [decimal](18, 0) NULL,
	[TotalLaborCost] [decimal](18, 0) NULL,
	[TotalDurationDays] [int] NULL,
	[CurrencyCode] [nvarchar](10) NULL,
	[Status] [nvarchar](50) NOT NULL,
	[CreatedAt] [datetime] NOT NULL,
	[CreatedBy] [int] NULL,
	[ApprovedAt] [datetime] NULL,
	[ApprovedBy] [int] NULL,
	[EstimationID] [int] IDENTITY(1,1) NOT NULL,
	[AccountID] [int] NULL,
 CONSTRAINT [PK_Estimations] PRIMARY KEY CLUSTERED 
(
	[EstimationID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EstimationSuppliers]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EstimationSuppliers](
	[EstimationSupplierID] [int] IDENTITY(1,1) NOT NULL,
	[EstimationID] [int] NOT NULL,
	[SupplierID] [int] NOT NULL,
	[SupplierQuoteReference] [nvarchar](255) NULL,
	[TotalQuotedCost] [decimal](18, 0) NULL,
	[CurrencyCode] [nvarchar](10) NULL,
	[ExpectedDeliveryDays] [int] NULL,
	[Notes] [nvarchar](max) NULL,
	[CreatedAt] [datetime] NOT NULL,
	[CreatedBy] [int] NULL,
	[ModifiedAt] [datetime] NULL,
	[ModifiedBy] [int] NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[EstimationSupplierID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ExportJobs]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ExportJobs](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[JobType] [nvarchar](50) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[Progress] [int] NOT NULL,
	[ParamsJson] [nvarchar](max) NULL,
	[CreatedBy] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[StartedAt] [datetime2](7) NULL,
	[CompletedAt] [datetime2](7) NULL,
	[ExpiresAt] [datetime2](7) NULL,
	[ErrorMessage] [nvarchar](1000) NULL,
	[FileName] [nvarchar](255) NULL,
	[FilePath] [nvarchar](500) NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InfoOptionTranslations]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InfoOptionTranslations](
	[InfoOptionTranslationID] [int] IDENTITY(1,1) NOT NULL,
	[OptionID] [int] NOT NULL,
	[LangCode] [varchar](10) NOT NULL,
	[OptionValue] [nvarchar](255) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[InfoOptionTranslationID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Information]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Information](
	[InfoID] [int] NOT NULL,
	[LabelEng] [varchar](150) NOT NULL,
	[LabelFr] [varchar](150) NOT NULL,
	[InfoType] [varchar](30) NOT NULL,
	[InfoValue1] [varchar](255) NULL,
	[InfoValue2] [varchar](255) NULL,
	[UOM1] [varchar](20) NULL,
	[UOM2] [varchar](20) NULL,
	[SubID] [int] NOT NULL,
	[ConvID] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InformationChangeLogs]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InformationChangeLogs](
	[LogID] [int] NOT NULL,
	[SheetID] [int] NOT NULL,
	[InfoTemplateID] [int] NOT NULL,
	[OldValue] [nvarchar](255) NULL,
	[NewValue] [nvarchar](255) NULL,
	[UOM] [nvarchar](50) NULL,
	[ChangedAt] [datetime] NULL,
	[ChangedBy] [nvarchar](100) NULL,
	[FieldChanged] [varchar](50) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InformationTemplateOptions]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InformationTemplateOptions](
	[OptionID] [int] IDENTITY(1,1) NOT NULL,
	[InfoTemplateID] [int] NOT NULL,
	[OptionValue] [varchar](100) NOT NULL,
	[SortOrder] [int] NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[OptionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InformationTemplates]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InformationTemplates](
	[InfoTemplateID] [int] IDENTITY(1,1) NOT NULL,
	[SubID] [int] NOT NULL,
	[Label] [varchar](150) NOT NULL,
	[InfoType] [varchar](30) NOT NULL,
	[OrderIndex] [int] NULL,
	[UOM] [varchar](50) NULL,
	[Required] [bit] NOT NULL,
	[TemplateInfoTemplateID] [int] NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[InfoTemplateID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InformationValues]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InformationValues](
	[InfoValueID] [int] IDENTITY(1,1) NOT NULL,
	[InfoTemplateID] [int] NOT NULL,
	[SheetID] [int] NOT NULL,
	[InfoValue] [varchar](255) NULL,
	[UOM] [varchar](20) NULL,
	[RevisionID] [int] NULL,
	[ValueSetID] [int] NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[InfoValueID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InformationValueSets]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InformationValueSets](
	[ValueSetID] [int] IDENTITY(1,1) NOT NULL,
	[SheetID] [int] NOT NULL,
	[ContextID] [int] NOT NULL,
	[PartyID] [int] NULL,
	[Status] [varchar](30) NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [int] NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[UpdatedBy] [int] NULL,
	[AccountID] [int] NULL,
 CONSTRAINT [PK_InformationValueSets] PRIMARY KEY CLUSTERED 
(
	[ValueSetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InfoTemplateGrouping]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InfoTemplateGrouping](
	[InfoTemplateID] [int] NOT NULL,
	[GroupKey] [nvarchar](128) NOT NULL,
	[CellIndex] [int] NOT NULL,
	[CellCaption] [nvarchar](32) NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[InfoTemplateID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InfoTemplateTranslations]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InfoTemplateTranslations](
	[InfoTemplateTranslationID] [int] IDENTITY(1,1) NOT NULL,
	[InfoTemplateID] [int] NOT NULL,
	[LangCode] [varchar](10) NOT NULL,
	[Label] [nvarchar](255) NOT NULL,
	[SourceLanguage] [nvarchar](15) NULL,
	[IsMachineTranslated] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[InfoTemplateTranslationID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InspectionResults]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InspectionResults](
	[ResultID] [int] IDENTITY(1,1) NOT NULL,
	[InspectionID] [int] NOT NULL,
	[InfoTemplateID] [int] NULL,
	[Result] [varchar](20) NOT NULL,
	[MeasuredValue] [nvarchar](255) NULL,
	[UOM] [nvarchar](50) NULL,
PRIMARY KEY CLUSTERED 
(
	[ResultID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Inspections]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Inspections](
	[InspectionID] [int] IDENTITY(1,1) NOT NULL,
	[SheetID] [int] NOT NULL,
	[InspectionTypeID] [int] NOT NULL,
	[Status] [varchar](30) NOT NULL,
	[PerformedAt] [datetime2](7) NULL,
	[PerformedBy] [int] NULL,
	[Notes] [nvarchar](2000) NULL,
PRIMARY KEY CLUSTERED 
(
	[InspectionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InspectionTypes]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InspectionTypes](
	[InspectionTypeID] [int] IDENTITY(1,1) NOT NULL,
	[DisciplineID] [int] NOT NULL,
	[Name] [varchar](150) NOT NULL,
	[StandardRef] [varchar](100) NULL,
PRIMARY KEY CLUSTERED 
(
	[InspectionTypeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InstrumentDatasheetLinks]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InstrumentDatasheetLinks](
	[InstrumentDatasheetLinkID] [int] IDENTITY(1,1) NOT NULL,
	[AccountID] [int] NOT NULL,
	[InstrumentID] [int] NOT NULL,
	[SheetID] [int] NOT NULL,
	[LinkRole] [nvarchar](60) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [int] NULL,
	[LinkRoleKey]  AS (isnull([LinkRole],N'')) PERSISTED NOT NULL,
 CONSTRAINT [PK_InstrumentDatasheetLinks] PRIMARY KEY CLUSTERED 
(
	[InstrumentDatasheetLinkID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InstrumentLoopMembers]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InstrumentLoopMembers](
	[InstrumentLoopMemberID] [int] IDENTITY(1,1) NOT NULL,
	[AccountID] [int] NOT NULL,
	[LoopID] [int] NOT NULL,
	[InstrumentID] [int] NOT NULL,
	[Role] [nvarchar](60) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [int] NULL,
 CONSTRAINT [PK_InstrumentLoopMembers] PRIMARY KEY CLUSTERED 
(
	[InstrumentLoopMemberID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InstrumentLoops]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InstrumentLoops](
	[LoopID] [int] IDENTITY(1,1) NOT NULL,
	[LoopTag] [nvarchar](80) NOT NULL,
	[Service] [nvarchar](200) NULL,
	[System] [nvarchar](200) NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[AccountID] [int] NULL,
	[LoopTagNorm] [nvarchar](160) NULL,
	[LockedAt] [datetime2](7) NULL,
	[LockedBy] [int] NULL,
 CONSTRAINT [PK_InstrumentLoops] PRIMARY KEY CLUSTERED 
(
	[LoopID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Instruments]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Instruments](
	[InstrumentID] [int] IDENTITY(1,1) NOT NULL,
	[AccountID] [int] NOT NULL,
	[InstrumentTag] [nvarchar](160) NOT NULL,
	[InstrumentTagNorm] [nvarchar](160) NOT NULL,
	[InstrumentType] [nvarchar](80) NULL,
	[Service] [nvarchar](160) NULL,
	[System] [nvarchar](160) NULL,
	[Area] [nvarchar](160) NULL,
	[Location] [nvarchar](255) NULL,
	[Status] [nvarchar](40) NULL,
	[Notes] [nvarchar](2000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [int] NULL,
	[UpdatedBy] [int] NULL,
 CONSTRAINT [PK_Instruments] PRIMARY KEY CLUSTERED 
(
	[InstrumentID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InstrumentTagRules]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InstrumentTagRules](
	[RuleID] [int] IDENTITY(1,1) NOT NULL,
	[AccountID] [int] NOT NULL,
	[Prefix] [nvarchar](40) NULL,
	[Separator] [nvarchar](10) NULL,
	[MinNumberDigits] [int] NULL,
	[MaxNumberDigits] [int] NULL,
	[AllowedAreaCodes] [nvarchar](400) NULL,
	[RegexPattern] [nvarchar](400) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [int] NULL,
	[UpdatedBy] [int] NULL,
 CONSTRAINT [PK_InstrumentTagRules] PRIMARY KEY CLUSTERED 
(
	[RuleID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Inventory]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Inventory](
	[InventoryID] [int] IDENTITY(1,1) NOT NULL,
	[SheetID] [int] NULL,
	[WarehouseID] [int] NOT NULL,
	[Quantity] [int] NOT NULL,
	[LastUpdated] [datetime] NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[InventoryID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InventoryAuditLogs]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InventoryAuditLogs](
	[AuditLogID] [int] IDENTITY(1,1) NOT NULL,
	[InventoryID] [int] NOT NULL,
	[ActionType] [nvarchar](50) NOT NULL,
	[OldValue] [nvarchar](max) NULL,
	[NewValue] [nvarchar](max) NULL,
	[ChangedBy] [int] NOT NULL,
	[ChangedAt] [datetime] NOT NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[AuditLogID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InventoryItems]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InventoryItems](
	[InventoryItemID] [int] IDENTITY(1,1) NOT NULL,
	[InventoryID] [int] NOT NULL,
	[ItemCode] [nvarchar](100) NOT NULL,
	[ItemName] [nvarchar](255) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[CategoryID] [int] NULL,
	[SupplierID] [int] NULL,
	[ManufacturerID] [int] NULL,
	[Location] [nvarchar](255) NULL,
	[QuantityOnHand] [decimal](18, 0) NOT NULL,
	[ReorderLevel] [decimal](18, 0) NOT NULL,
	[UOM] [nvarchar](50) NULL,
	[CreatedAt] [datetime] NOT NULL,
	[UpdatedAt] [datetime] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[UnitCost] [decimal](18, 2) NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[InventoryItemID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InventoryItemTranslations]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InventoryItemTranslations](
	[InventoryItemTranslationID] [int] NOT NULL,
	[InventoryID] [int] NOT NULL,
	[LanguageCode] [nvarchar](10) NOT NULL,
	[ItemNameTranslation] [nvarchar](255) NOT NULL,
	[DescriptionTranslation] [nvarchar](1000) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InventoryMaintenanceLogs]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InventoryMaintenanceLogs](
	[MaintenanceLogID] [int] IDENTITY(1,1) NOT NULL,
	[InventoryID] [int] NOT NULL,
	[MaintenanceDate] [datetime] NOT NULL,
	[Description] [nvarchar](1000) NOT NULL,
	[PerformedBy] [int] NOT NULL,
	[Notes] [nvarchar](1000) NULL,
	[CreatedAt] [datetime] NOT NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[MaintenanceLogID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InventoryTransactions]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InventoryTransactions](
	[TransactionID] [int] IDENTITY(1,1) NOT NULL,
	[InventoryID] [int] NOT NULL,
	[TransactionType] [nvarchar](50) NOT NULL,
	[QuantityChanged] [decimal](18, 4) NOT NULL,
	[UOM] [nvarchar](50) NULL,
	[ReferenceNote] [nvarchar](500) NULL,
	[PerformedBy] [int] NOT NULL,
	[PerformedAt] [datetime] NOT NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[TransactionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Languages]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Languages](
	[LanguageCode] [varchar](10) NOT NULL,
	[LanguageName] [nvarchar](100) NOT NULL,
	[FlagEmoji] [nvarchar](10) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LayoutBindings]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LayoutBindings](
	[BindingID] [int] IDENTITY(1,1) NOT NULL,
	[BlockID] [int] NOT NULL,
	[VisibilityExpr] [nvarchar](max) NULL,
	[FormatExpr] [nvarchar](max) NULL,
	[StyleJSON] [nvarchar](max) NULL,
	[PageBreakBefore] [bit] NOT NULL,
	[KeepWithNext] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[BindingID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LayoutBlocks]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LayoutBlocks](
	[BlockID] [int] IDENTITY(1,1) NOT NULL,
	[RegionID] [int] NOT NULL,
	[BlockType] [nvarchar](24) NOT NULL,
	[SourceRef] [nvarchar](max) NULL,
	[PropsJSON] [nvarchar](max) NULL,
	[X] [int] NOT NULL,
	[Y] [int] NOT NULL,
	[W] [int] NOT NULL,
	[H] [int] NOT NULL,
	[OrderIndex] [int] NOT NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[BlockID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LayoutBodySlots]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LayoutBodySlots](
	[LayoutID] [int] NOT NULL,
	[SlotIndex] [int] NOT NULL,
	[SubsheetID] [int] NOT NULL,
	[ColumnNumber] [int] NULL,
	[RowNumber] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[Width] [int] NOT NULL,
	[AccountID] [int] NULL,
 CONSTRAINT [PK_LayoutBodySlots] PRIMARY KEY CLUSTERED 
(
	[LayoutID] ASC,
	[SlotIndex] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LayoutRegions]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LayoutRegions](
	[RegionID] [int] IDENTITY(1,1) NOT NULL,
	[LayoutID] [int] NOT NULL,
	[Kind] [nvarchar](16) NOT NULL,
	[Name] [nvarchar](64) NOT NULL,
	[X] [int] NOT NULL,
	[Y] [int] NOT NULL,
	[W] [int] NOT NULL,
	[H] [int] NOT NULL,
	[StyleJSON] [nvarchar](max) NULL,
	[OrderIndex] [int] NOT NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[RegionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LayoutSubsheetSlots]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LayoutSubsheetSlots](
	[LayoutID] [int] NOT NULL,
	[SubsheetID] [int] NOT NULL,
	[SlotIndex] [int] NOT NULL,
	[InfoTemplateID] [int] NOT NULL,
	[ColumnNumber] [int] NULL,
	[RowNumber] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[OrderInColumn] [int] NOT NULL,
	[ColumnNumberNorm]  AS (isnull([ColumnNumber],(1))) PERSISTED NOT NULL,
	[AccountID] [int] NULL,
 CONSTRAINT [PK_LayoutSubsheetSlots] PRIMARY KEY CLUSTERED 
(
	[LayoutID] ASC,
	[SubsheetID] ASC,
	[SlotIndex] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LifecycleStates]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LifecycleStates](
	[LifecycleStateID] [int] IDENTITY(1,1) NOT NULL,
	[Code] [varchar](30) NOT NULL,
	[Name] [varchar](80) NOT NULL,
	[SortOrder] [int] NOT NULL,
	[IsTerminal] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_LifecycleStates] PRIMARY KEY CLUSTERED 
(
	[LifecycleStateID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Logs]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Logs](
	[LogID] [int] NOT NULL,
	[LogDTime] [datetime] NOT NULL,
	[LogType] [int] NOT NULL,
	[UserID] [int] NOT NULL,
	[TableName] [varchar](50) NOT NULL,
	[PKID] [int] NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LoopInstruments]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LoopInstruments](
	[LoopInstrumentID] [int] IDENTITY(1,1) NOT NULL,
	[LoopID] [int] NOT NULL,
	[AssetID] [int] NULL,
	[SheetID] [int] NULL,
	[Role] [varchar](40) NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[AccountID] [int] NULL,
 CONSTRAINT [PK_LoopInstruments] PRIMARY KEY CLUSTERED 
(
	[LoopInstrumentID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MaintenanceLogs]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MaintenanceLogs](
	[MaintenanceID] [int] NOT NULL,
	[SheetID] [int] NOT NULL,
	[MaintenanceDate] [date] NOT NULL,
	[IssueReported] [varchar](255) NULL,
	[ActionTaken] [varchar](255) NULL,
	[TechnicianID] [int] NULL,
	[NextCheckDue] [date] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Manufacturers]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Manufacturers](
	[ManuID] [int] NOT NULL,
	[ManuName] [varchar](150) NOT NULL,
	[ManuAddress] [varchar](255) NOT NULL,
	[CreatedAt] [datetime2](3) NOT NULL,
	[UpdatedAt] [datetime2](3) NOT NULL,
	[AccountID] [int] NULL,
 CONSTRAINT [PK_Manufacturers] PRIMARY KEY CLUSTERED 
(
	[ManuID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MirrorTemplates]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MirrorTemplates](
	[Id] [uniqueidentifier] NOT NULL,
	[ClientKey] [nvarchar](128) NOT NULL,
	[SourceKind] [nvarchar](16) NOT NULL,
	[DefinitionJson] [nvarchar](max) NOT NULL,
	[FingerprintHash]  AS (checksum([DefinitionJson])) PERSISTED,
	[CreatedAt] [datetime2](3) NOT NULL,
	[UpdatedAt] [datetime2](3) NOT NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Notes]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Notes](
	[NoteID] [int] NOT NULL,
	[NoteDesc] [varchar](max) NOT NULL,
	[NoteDate] [date] NOT NULL,
	[SheetID] [int] NOT NULL,
	[NotedByID] [int] NOT NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[NoteTypes]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NoteTypes](
	[NoteTypeID] [int] IDENTITY(1,1) NOT NULL,
	[NoteType] [varchar](50) NOT NULL,
	[Description] [nvarchar](255) NULL,
PRIMARY KEY CLUSTERED 
(
	[NoteTypeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[NotificationRecipients]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NotificationRecipients](
	[NotificationID] [int] NOT NULL,
	[UserID] [int] NOT NULL,
	[IsRead] [bit] NULL,
	[AccountID] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Notifications]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Notifications](
	[NotificationID] [int] NOT NULL,
	[Title] [nvarchar](255) NULL,
	[Message] [nvarchar](max) NULL,
	[Link] [nvarchar](255) NULL,
	[NotificationType] [nvarchar](50) NULL,
	[RelatedEntityID] [int] NULL,
	[EntityType] [nvarchar](50) NULL,
	[CreatedAt] [datetime] NULL,
	[CreatedBy] [int] NULL,
	[AccountID] [int] NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Parties]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Parties](
	[PartyID] [int] IDENTITY(1,1) NOT NULL,
	[PartyType] [varchar](30) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Email] [nvarchar](200) NULL,
	[Phone] [nvarchar](100) NULL,
	[Address] [nvarchar](500) NULL,
	[ExternalRef] [nvarchar](200) NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[AccountID] [int] NULL,
 CONSTRAINT [PK_Parties] PRIMARY KEY CLUSTERED 
(
	[PartyID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Permissions]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Permissions](
	[PermissionID] [int] IDENTITY(1,1) NOT NULL,
	[PermissionKey] [nvarchar](100) NOT NULL,
	[Description] [nvarchar](255) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[PermissionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PlatformAdmins]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PlatformAdmins](
	[PlatformAdminID] [uniqueidentifier] NOT NULL,
	[UserID] [int] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](3) NOT NULL,
	[CreatedByUserID] [int] NULL,
	[RevokedAt] [datetime2](3) NULL,
	[RevokedByUserID] [int] NULL,
 CONSTRAINT [PK_PlatformAdmins] PRIMARY KEY CLUSTERED 
(
	[PlatformAdminID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Projects]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Projects](
	[ProjectID] [int] NOT NULL,
	[ClientID] [int] NOT NULL,
	[ClientProjNum] [varchar](15) NOT NULL,
	[ProjNum] [varchar](15) NOT NULL,
	[ProjName] [varchar](255) NOT NULL,
	[ProjDesc] [varchar](255) NOT NULL,
	[ManagerID] [int] NOT NULL,
	[StartDate] [date] NOT NULL,
	[EndDate] [date] NULL,
	[CreatedAt] [datetime2](3) NOT NULL,
	[UpdatedAt] [datetime2](3) NOT NULL,
	[AccountID] [int] NULL,
 CONSTRAINT [PK_Projects] PRIMARY KEY CLUSTERED 
(
	[ProjectID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RatingsBlocks]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RatingsBlocks](
	[RatingsBlockID] [int] IDENTITY(1,1) NOT NULL,
	[SheetID] [int] NOT NULL,
	[BlockType] [varchar](40) NOT NULL,
	[SourceValueSetID] [int] NULL,
	[LockedAt] [datetime2](0) NULL,
	[LockedBy] [int] NULL,
	[Notes] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_RatingsBlocks] PRIMARY KEY CLUSTERED 
(
	[RatingsBlockID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RatingsEntries]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RatingsEntries](
	[EntryID] [int] IDENTITY(1,1) NOT NULL,
	[RatingsBlockID] [int] NOT NULL,
	[Key] [nvarchar](120) NOT NULL,
	[Value] [nvarchar](255) NULL,
	[UOM] [nvarchar](50) NULL,
	[OrderIndex] [int] NOT NULL,
 CONSTRAINT [PK_RatingsEntries] PRIMARY KEY CLUSTERED 
(
	[EntryID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RolePermissions]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RolePermissions](
	[RoleID] [int] NOT NULL,
	[PermissionID] [int] NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Roles]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Roles](
	[RoleID] [int] NOT NULL,
	[RoleName] [nvarchar](50) NULL,
	[CreatedAt] [datetime2](3) NOT NULL,
	[UpdatedAt] [datetime2](3) NOT NULL,
 CONSTRAINT [PK_Roles] PRIMARY KEY CLUSTERED 
(
	[RoleID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RolesActions]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RolesActions](
	[RAID] [int] NOT NULL,
	[RoleID] [int] NOT NULL,
	[ActionID] [int] NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ScheduleColumns]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ScheduleColumns](
	[ScheduleColumnID] [bigint] IDENTITY(1,1) NOT NULL,
	[AccountID] [int] NOT NULL,
	[ScheduleID] [int] NOT NULL,
	[ColumnKey] [nvarchar](64) NOT NULL,
	[ColumnLabel] [nvarchar](128) NOT NULL,
	[DataType] [nvarchar](20) NOT NULL,
	[EnumOptionsJSON] [nvarchar](max) NULL,
	[DisplayOrder] [int] NOT NULL,
	[IsRequired] [bit] NOT NULL,
	[IsEditable] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [int] NULL,
 CONSTRAINT [PK_ScheduleColumns] PRIMARY KEY CLUSTERED 
(
	[ScheduleColumnID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ScheduleEntries]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ScheduleEntries](
	[ScheduleEntryID] [bigint] IDENTITY(1,1) NOT NULL,
	[ScheduleID] [int] NOT NULL,
	[AssetID] [int] NULL,
	[SheetID] [int] NULL,
	[RowDataJSON] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [int] NULL,
	[AccountID] [int] NOT NULL,
 CONSTRAINT [PK_ScheduleEntries] PRIMARY KEY CLUSTERED 
(
	[ScheduleEntryID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ScheduleEntryValues]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ScheduleEntryValues](
	[ScheduleEntryValueID] [bigint] IDENTITY(1,1) NOT NULL,
	[AccountID] [int] NOT NULL,
	[ScheduleEntryID] [bigint] NOT NULL,
	[ScheduleColumnID] [bigint] NOT NULL,
	[ValueString] [nvarchar](4000) NULL,
	[ValueNumber] [decimal](18, 6) NULL,
	[ValueBool] [bit] NULL,
	[ValueDate] [date] NULL,
	[ValueJson] [nvarchar](max) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedBy] [int] NULL,
 CONSTRAINT [PK_ScheduleEntryValues] PRIMARY KEY CLUSTERED 
(
	[ScheduleEntryValueID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Schedules]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Schedules](
	[ScheduleID] [int] IDENTITY(1,1) NOT NULL,
	[DisciplineID] [int] NOT NULL,
	[SubtypeID] [int] NULL,
	[Name] [nvarchar](150) NOT NULL,
	[Scope] [varchar](30) NOT NULL,
	[ClientID] [int] NULL,
	[ProjectID] [int] NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [int] NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[UpdatedBy] [int] NULL,
	[AccountID] [int] NOT NULL,
 CONSTRAINT [PK_Schedules] PRIMARY KEY CLUSTERED 
(
	[ScheduleID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Sessions]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Sessions](
	[UserSessionID] [int] NOT NULL,
	[UserID] [int] NOT NULL,
	[SessionID] [varchar](255) NOT NULL,
	[SessionKey] [varchar](32) NOT NULL,
	[SessionToken] [varchar](32) NOT NULL,
	[Activity] [int] NOT NULL,
	[SessionIP] [varchar](32) NOT NULL,
	[ReferenceURL] [varchar](32) NULL,
	[AccountID] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SheetAttachmentLinks]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SheetAttachmentLinks](
	[SheetID] [int] NOT NULL,
	[AttachmentID] [int] NOT NULL,
 CONSTRAINT [PK_SheetAttachmentLinks] PRIMARY KEY CLUSTERED 
(
	[SheetID] ASC,
	[AttachmentID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SheetAttachments]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SheetAttachments](
	[SheetAttachmentID] [int] IDENTITY(1,1) NOT NULL,
	[SheetID] [int] NOT NULL,
	[AttachmentID] [int] NOT NULL,
	[OrderIndex] [int] NOT NULL,
	[IsFromTemplate] [bit] NOT NULL,
	[LinkedFromSheetID] [int] NULL,
	[CloneOnCreate] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[SheetAttachmentID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SheetHeaderKV]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SheetHeaderKV](
	[SheetID] [int] NOT NULL,
	[FieldKey] [nvarchar](64) NOT NULL,
	[FieldValue] [nvarchar](max) NULL,
	[UOM] [nvarchar](32) NULL,
	[SortOrder] [int] NULL,
	[AccountID] [int] NULL,
 CONSTRAINT [PK_SheetHeaderKV] PRIMARY KEY CLUSTERED 
(
	[SheetID] ASC,
	[FieldKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SheetNotes]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SheetNotes](
	[NoteID] [int] IDENTITY(1,1) NOT NULL,
	[SheetID] [int] NOT NULL,
	[NoteTypeID] [int] NOT NULL,
	[NoteText] [nvarchar](max) NOT NULL,
	[OrderIndex] [int] NOT NULL,
	[CreatedBy] [int] NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedBy] [int] NULL,
	[UpdatedAt] [datetime2](0) NULL,
	[AccountID] [int] NULL,
 CONSTRAINT [PK_SheetNotes_New] PRIMARY KEY CLUSTERED 
(
	[NoteID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SheetRevisions]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SheetRevisions](
	[RevisionID] [int] IDENTITY(1,1) NOT NULL,
	[SheetID] [int] NULL,
	[RevisionNum] [int] NULL,
	[RevisionDate] [date] NULL,
	[Status] [varchar](50) NULL,
	[PreparedByID] [int] NULL,
	[PreparedByDate] [date] NULL,
	[VerifiedByID] [int] NULL,
	[VerifiedByDate] [date] NULL,
	[ApprovedByID] [int] NULL,
	[ApprovedByDate] [date] NULL,
	[Notes] [varchar](max) NULL,
	[IsCurrent] [bit] NULL,
	[SnapshotJson] [nvarchar](max) NULL,
	[CreatedByID] [int] NULL,
	[CreatedByDate] [datetime2](0) NULL,
	[SystemRevisionNum] [int] NOT NULL,
	[SystemRevisionAt] [datetime2](7) NOT NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[RevisionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Sheets]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Sheets](
	[SheetID] [int] IDENTITY(1,1) NOT NULL,
	[SheetName] [varchar](255) NOT NULL,
	[SheetDesc] [varchar](255) NOT NULL,
	[SheetDesc2] [varchar](255) NOT NULL,
	[ClientDocNum] [int] NULL,
	[ClientProjNum] [int] NULL,
	[CompanyDocNum] [int] NULL,
	[CompanyProjNum] [int] NULL,
	[AreaID] [int] NOT NULL,
	[PackageName] [varchar](100) NOT NULL,
	[RevisionNum] [int] NOT NULL,
	[RevisionDate] [date] NOT NULL,
	[PreparedByID] [int] NOT NULL,
	[PreparedByDate] [datetime] NOT NULL,
	[VerifiedByID] [int] NULL,
	[VerifiedByDate] [datetime] NULL,
	[ApprovedByID] [int] NULL,
	[ApprovedByDate] [datetime] NULL,
	[EquipmentName] [varchar](150) NOT NULL,
	[EquipmentTagNum] [varchar](150) NOT NULL,
	[ServiceName] [varchar](150) NOT NULL,
	[RequiredQty] [int] NOT NULL,
	[ItemLocation] [varchar](255) NOT NULL,
	[ManuID] [int] NOT NULL,
	[SuppID] [int] NOT NULL,
	[InstallPackNum] [varchar](100) NOT NULL,
	[EquipSize] [int] NULL,
	[ModelNum] [varchar](50) NOT NULL,
	[Driver] [varchar](150) NULL,
	[LocationDwg] [varchar](255) NULL,
	[PID] [int] NOT NULL,
	[InstallDwg] [varchar](255) NULL,
	[CodeStd] [varchar](255) NULL,
	[CategoryID] [int] NULL,
	[ClientID] [int] NULL,
	[ProjectID] [int] NULL,
	[TemplateID] [int] NULL,
	[ParentSheetID] [int] NULL,
	[Status] [varchar](50) NOT NULL,
	[IsLatest] [bit] NOT NULL,
	[IsTemplate] [bit] NOT NULL,
	[RejectComment] [nvarchar](1000) NULL,
	[ModifiedByID] [int] NULL,
	[ModifiedByDate] [datetime] NULL,
	[AutoCADImport] [bit] NOT NULL,
	[SourceFilePath] [nvarchar](500) NULL,
	[RejectedByID] [int] NULL,
	[RejectedByDate] [datetime] NULL,
	[IsSuperseded] [bit] NOT NULL,
	[DisciplineID] [int] NULL,
	[SubtypeID] [int] NULL,
	[LifecycleStateID] [int] NULL,
	[AssetID] [int] NULL,
	[EngineeringRevision] [nvarchar](50) NULL,
	[ClientRevisionCode] [nvarchar](50) NULL,
	[AccountID] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[SheetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Sheets_Backup]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Sheets_Backup](
	[SheetID] [int] NOT NULL,
	[SheetName] [varchar](255) NOT NULL,
	[SheetDesc] [varchar](255) NOT NULL,
	[SheetDesc2] [varchar](255) NOT NULL,
	[ClientDocNum] [int] NULL,
	[ClientProjNum] [int] NULL,
	[CompanyDocNum] [int] NULL,
	[CompanyProjNum] [int] NULL,
	[AreaID] [int] NOT NULL,
	[PackageName] [varchar](100) NOT NULL,
	[RevisionNum] [int] NOT NULL,
	[RevisionDate] [date] NOT NULL,
	[PreparedByID] [int] NOT NULL,
	[PreparedByDate] [datetime] NOT NULL,
	[VerifiedByID] [int] NULL,
	[VerifiedByDate] [datetime] NULL,
	[ApprovedByID] [int] NULL,
	[ApprovedByDate] [datetime] NULL,
	[EquipmentName] [varchar](150) NOT NULL,
	[EquipmentTagNum] [varchar](150) NOT NULL,
	[ServiceName] [varchar](150) NOT NULL,
	[RequiredQty] [int] NOT NULL,
	[ItemLocation] [varchar](255) NOT NULL,
	[ManuID] [int] NOT NULL,
	[SuppID] [int] NOT NULL,
	[InstallPackNum] [varchar](100) NOT NULL,
	[EquipSize] [int] NOT NULL,
	[ModelNum] [varchar](50) NOT NULL,
	[Driver] [varchar](150) NULL,
	[LocationDwg] [varchar](255) NULL,
	[PID] [int] NOT NULL,
	[InstallDwg] [varchar](255) NULL,
	[CodeStd] [varchar](255) NULL,
	[CategoryID] [int] NULL,
	[ClientID] [int] NULL,
	[ProjectID] [int] NULL,
	[TemplateID] [int] NULL,
	[ParentSheetID] [int] NULL,
	[Status] [varchar](50) NOT NULL,
	[IsLatest] [bit] NOT NULL,
	[IsTemplate] [bit] NOT NULL,
	[RejectComment] [nvarchar](1000) NULL,
	[ModifiedByID] [int] NULL,
	[ModifiedByDate] [datetime] NULL,
	[AutoCADImport] [bit] NOT NULL,
	[SourceFilePath] [nvarchar](500) NULL,
	[RejectedByID] [int] NULL,
	[RejectedByDate] [datetime] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SheetTemplates]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SheetTemplates](
	[TemplateID] [int] NOT NULL,
	[TemplateName] [varchar](150) NOT NULL,
	[IsPublic] [bit] NULL,
	[CreatedByID] [int] NOT NULL,
	[CreatedDate] [datetime] NULL,
	[DisciplineID] [int] NULL,
	[SubtypeID] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SheetTranslations]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SheetTranslations](
	[TransID] [int] IDENTITY(1,1) NOT NULL,
	[SheetID] [int] NOT NULL,
	[LangCode] [varchar](10) NOT NULL,
	[SheetName] [nvarchar](255) NOT NULL,
	[SheetDesc] [nvarchar](1000) NULL,
	[SheetDesc2] [nvarchar](1000) NULL,
	[EquipmentName] [nvarchar](255) NULL,
	[ServiceName] [nvarchar](255) NULL,
	[SourceLanguage] [nvarchar](15) NULL,
	[IsMachineTranslated] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[TransID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SubsheetNameChangeLogs]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SubsheetNameChangeLogs](
	[LogID] [int] NOT NULL,
	[SubID] [int] NOT NULL,
	[LanguageCode] [varchar](10) NOT NULL,
	[OldName] [nvarchar](150) NULL,
	[NewName] [nvarchar](150) NULL,
	[ChangedAt] [datetime] NULL,
	[ChangedBy] [nvarchar](100) NULL,
	[SheetID] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SubSheets]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SubSheets](
	[SubID] [int] IDENTITY(1,1) NOT NULL,
	[SubName] [varchar](150) NOT NULL,
	[SheetID] [int] NOT NULL,
	[OrderIndex] [int] NOT NULL,
	[TemplateSubID] [int] NULL,
	[Kind] [nvarchar](32) NULL,
	[ConfigJSON] [nvarchar](max) NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[SubID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SubsheetTranslations]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SubsheetTranslations](
	[SubsheetTranslationID] [int] IDENTITY(1,1) NOT NULL,
	[SubID] [int] NOT NULL,
	[LangCode] [varchar](10) NOT NULL,
	[SubName] [nvarchar](255) NOT NULL,
	[SourceLanguage] [nvarchar](15) NULL,
	[IsMachineTranslated] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[SubsheetTranslationID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Suggestions]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Suggestions](
	[SuggID] [int] NOT NULL,
	[InfoID] [int] NOT NULL,
	[SuggValue] [varchar](150) NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Suppliers]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Suppliers](
	[SuppID] [int] IDENTITY(1,1) NOT NULL,
	[SuppName] [nvarchar](255) NOT NULL,
	[SuppAddress] [nvarchar](max) NULL,
	[SuppCode] [nvarchar](50) NULL,
	[SuppContact] [nvarchar](255) NULL,
	[SuppEmail] [nvarchar](255) NULL,
	[SuppPhone] [nvarchar](50) NULL,
	[Notes] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](3) NOT NULL,
	[UpdatedAt] [datetime2](3) NOT NULL,
	[AccountID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[SuppID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SupportImpersonationSessions]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SupportImpersonationSessions](
	[SessionID] [uniqueidentifier] NOT NULL,
	[PlatformUserID] [int] NOT NULL,
	[AccountID] [int] NOT NULL,
	[StartedAt] [datetime2](3) NOT NULL,
	[EndedAt] [datetime2](3) NULL,
	[Reason] [nvarchar](500) NULL,
PRIMARY KEY CLUSTERED 
(
	[SessionID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TemplateChangeLogs]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TemplateChangeLogs](
	[TemplateChangeLogID] [int] IDENTITY(1,1) NOT NULL,
	[SheetID] [int] NOT NULL,
	[Message] [nvarchar](500) NOT NULL,
	[ChangedBy] [int] NOT NULL,
	[ChangeDate] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[TemplateChangeLogID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TemplateLabelChangeLogs]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TemplateLabelChangeLogs](
	[LogID] [int] NOT NULL,
	[InfoTemplateID] [int] NOT NULL,
	[LanguageCode] [varchar](10) NOT NULL,
	[OldLabel] [nvarchar](150) NULL,
	[NewLabel] [nvarchar](150) NULL,
	[ChangedAt] [datetime] NULL,
	[ChangedBy] [nvarchar](100) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Translations]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Translations](
	[TranslationID] [int] NOT NULL,
	[EntityType] [varchar](50) NOT NULL,
	[EntityID] [int] NOT NULL,
	[LanguageCode] [varchar](10) NOT NULL,
	[FieldName] [varchar](100) NOT NULL,
	[TranslatedText] [varchar](255) NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UILabelTranslations]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UILabelTranslations](
	[LabelKey] [varchar](100) NOT NULL,
	[LanguageCode] [varchar](10) NOT NULL,
	[TranslatedText] [nvarchar](255) NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Units]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Units](
	[UnitID] [int] NOT NULL,
	[UnitSystem] [varchar](10) NOT NULL,
	[UnitCode] [varchar](20) NOT NULL,
	[UnitName] [varchar](50) NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserActiveAccount]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserActiveAccount](
	[UserID] [int] NOT NULL,
	[AccountID] [int] NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_UserActiveAccount] PRIMARY KEY CLUSTERED 
(
	[UserID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserLogs]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserLogs](
	[LogID] [int] NOT NULL,
	[UserID] [int] NOT NULL,
	[Action] [nvarchar](100) NOT NULL,
	[Module] [nvarchar](50) NOT NULL,
	[SheetID] [int] NULL,
	[Details] [nvarchar](max) NULL,
	[Timestamp] [datetime] NOT NULL,
	[IPAddress] [nvarchar](50) NULL,
	[BrowserAgent] [nvarchar](255) NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Users]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Users](
	[UserID] [int] IDENTITY(1,1) NOT NULL,
	[FirstName] [nvarchar](255) NOT NULL,
	[LastName] [nvarchar](255) NOT NULL,
	[Email] [nvarchar](255) NOT NULL,
	[PasswordHash] [nvarchar](255) NOT NULL,
	[RoleID] [int] NOT NULL,
	[ProfilePic] [nvarchar](255) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[IsPlatformSuperadmin] [bit] NOT NULL,
 CONSTRAINT [PK_Users_new] PRIMARY KEY CLUSTERED 
(
	[UserID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ValueContexts]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ValueContexts](
	[ContextID] [int] IDENTITY(1,1) NOT NULL,
	[Code] [varchar](30) NOT NULL,
	[Name] [varchar](80) NOT NULL,
	[SortOrder] [int] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_ValueContexts] PRIMARY KEY CLUSTERED 
(
	[ContextID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ValueSetFieldVariances]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ValueSetFieldVariances](
	[ValueSetID] [int] NOT NULL,
	[InfoTemplateID] [int] NOT NULL,
	[VarianceStatus] [varchar](30) NOT NULL,
	[ReviewedBy] [int] NULL,
	[ReviewedAt] [datetime2](7) NULL,
	[AccountID] [int] NULL,
 CONSTRAINT [PK_ValueSetFieldVariances] PRIMARY KEY CLUSTERED 
(
	[ValueSetID] ASC,
	[InfoTemplateID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[VerificationRecordAttachments]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VerificationRecordAttachments](
	[VerificationRecordID] [int] NOT NULL,
	[AttachmentID] [int] NOT NULL,
 CONSTRAINT [PK_VerificationRecordAttachments] PRIMARY KEY CLUSTERED 
(
	[VerificationRecordID] ASC,
	[AttachmentID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[VerificationRecordLinks]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VerificationRecordLinks](
	[VerificationRecordLinkID] [int] IDENTITY(1,1) NOT NULL,
	[AccountID] [int] NOT NULL,
	[VerificationRecordID] [int] NOT NULL,
	[SheetID] [int] NULL,
 CONSTRAINT [PK_VerificationRecordLinks] PRIMARY KEY CLUSTERED 
(
	[VerificationRecordLinkID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[VerificationRecords]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VerificationRecords](
	[VerificationRecordID] [int] IDENTITY(1,1) NOT NULL,
	[VerificationTypeID] [int] NOT NULL,
	[IssuerPartyID] [int] NULL,
	[Result] [varchar](20) NOT NULL,
	[IssuedAt] [datetime2](0) NULL,
	[ExpiresAt] [datetime2](0) NULL,
	[CertificateNumber] [nvarchar](120) NULL,
	[Notes] [nvarchar](2000) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [int] NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[UpdatedBy] [int] NULL,
	[AccountID] [int] NOT NULL,
 CONSTRAINT [PK_VerificationRecords] PRIMARY KEY CLUSTERED 
(
	[VerificationRecordID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[VerificationRecordTypes]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VerificationRecordTypes](
	[VerificationTypeID] [int] IDENTITY(1,1) NOT NULL,
	[Code] [varchar](50) NOT NULL,
	[Name] [nvarchar](150) NOT NULL,
	[StandardRef] [nvarchar](100) NULL,
	[DisciplineID] [int] NULL,
	[Description] [nvarchar](500) NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_VerificationRecordTypes] PRIMARY KEY CLUSTERED 
(
	[VerificationTypeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Warehouses]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Warehouses](
	[WarehouseID] [int] NOT NULL,
	[WarehouseName] [varchar](100) NOT NULL,
	[Location] [varchar](255) NOT NULL,
	[WarehouseCode] [nvarchar](50) NULL,
	[AccountID] [int] NULL
) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_AccountInvites_AccountID_Email_Pending]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_AccountInvites_AccountID_Email_Pending] ON [dbo].[AccountInvites]
(
	[AccountID] ASC,
	[Email] ASC
)
WHERE ([Status]=N'Pending')
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_AccountInvites_AccountID_Status]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_AccountInvites_AccountID_Status] ON [dbo].[AccountInvites]
(
	[AccountID] ASC,
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_AccountInvites_TokenHash]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_AccountInvites_TokenHash] ON [dbo].[AccountInvites]
(
	[TokenHash] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_AccountMembers_AccountID_IsActive]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_AccountMembers_AccountID_IsActive] ON [dbo].[AccountMembers]
(
	[AccountID] ASC,
	[IsActive] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_AccountMembers_AccountID_RoleID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_AccountMembers_AccountID_RoleID] ON [dbo].[AccountMembers]
(
	[AccountID] ASC,
	[RoleID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_AccountMembers_UserID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_AccountMembers_UserID] ON [dbo].[AccountMembers]
(
	[UserID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [UX_AccountMembers_OneOwnerPerAccount]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_AccountMembers_OneOwnerPerAccount] ON [dbo].[AccountMembers]
(
	[AccountID] ASC
)
WHERE ([IsOwner]=(1))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_AOT_AccountID_CreatedAt]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_AOT_AccountID_CreatedAt] ON [dbo].[AccountOwnershipTransfers]
(
	[AccountID] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Accounts_IsActive]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Accounts_IsActive] ON [dbo].[Accounts]
(
	[IsActive] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Accounts_OwnerUserID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Accounts_OwnerUserID] ON [dbo].[Accounts]
(
	[OwnerUserID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Areas_AccountID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Areas_AccountID] ON [dbo].[Areas]
(
	[AccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_Areas_AccountID_AreaCode]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Areas_AccountID_AreaCode] ON [dbo].[Areas]
(
	[AccountID] ASC,
	[AreaCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_Areas_AccountID_AreaName]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Areas_AccountID_AreaName] ON [dbo].[Areas]
(
	[AccountID] ASC,
	[AreaName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Assets_Account_Client_Project]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Assets_Account_Client_Project] ON [dbo].[Assets]
(
	[AccountID] ASC,
	[ClientID] ASC,
	[ProjectID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Assets_Client_Project]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Assets_Client_Project] ON [dbo].[Assets]
(
	[ClientID] ASC,
	[ProjectID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Assets_Discipline_Subtype]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Assets_Discipline_Subtype] ON [dbo].[Assets]
(
	[DisciplineID] ASC,
	[SubtypeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_Assets_Account_TagNorm]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_Assets_Account_TagNorm] ON [dbo].[Assets]
(
	[AccountID] ASC,
	[AssetTagNorm] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_AuditLogs_AccountID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_AuditLogs_AccountID] ON [dbo].[AuditLogs]
(
	[AccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_AuditLogs_AccountID_PerformedAt]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_AuditLogs_AccountID_PerformedAt] ON [dbo].[AuditLogs]
(
	[AccountID] ASC,
	[PerformedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ChangeLogs_SheetID_Date]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_ChangeLogs_SheetID_Date] ON [dbo].[ChangeLogs]
(
	[SheetID] ASC,
	[ChangeDate] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Clients_AccountID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Clients_AccountID] ON [dbo].[Clients]
(
	[AccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_Clients_AccountID_ClientCode]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Clients_AccountID_ClientCode] ON [dbo].[Clients]
(
	[AccountID] ASC,
	[ClientCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_Clients_Code]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_Clients_Code] ON [dbo].[Clients]
(
	[ClientCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_DatasheetSubtypes_Discipline]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_DatasheetSubtypes_Discipline] ON [dbo].[DatasheetSubtypes]
(
	[DisciplineID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_DatasheetSubtypes_Discipline_Code]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_DatasheetSubtypes_Discipline_Code] ON [dbo].[DatasheetSubtypes]
(
	[DisciplineID] ASC,
	[Code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Disciplines_Status]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Disciplines_Status] ON [dbo].[Disciplines]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_Disciplines_Code]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_Disciplines_Code] ON [dbo].[Disciplines]
(
	[Code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_EntityLinks_From]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_EntityLinks_From] ON [dbo].[EntityLinks]
(
	[FromEntityType] ASC,
	[FromEntityID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_EntityLinks_Relation]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_EntityLinks_Relation] ON [dbo].[EntityLinks]
(
	[RelationType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_EntityLinks_To]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_EntityLinks_To] ON [dbo].[EntityLinks]
(
	[ToEntityType] ASC,
	[ToEntityID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Estimations_AccountID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Estimations_AccountID] ON [dbo].[Estimations]
(
	[AccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ExportJobs_AccountID_CreatedAt]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_ExportJobs_AccountID_CreatedAt] ON [dbo].[ExportJobs]
(
	[AccountID] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ExportJobs_CreatedBy_CreatedAt]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_ExportJobs_CreatedBy_CreatedAt] ON [dbo].[ExportJobs]
(
	[CreatedBy] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ExportJobs_Status_ExpiresAt]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_ExportJobs_Status_ExpiresAt] ON [dbo].[ExportJobs]
(
	[Status] ASC,
	[ExpiresAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_InfoTemplates_Sub]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_InfoTemplates_Sub] ON [dbo].[InformationTemplates]
(
	[SubID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_InformationValues_Sheet_Template_Rev]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_InformationValues_Sheet_Template_Rev] ON [dbo].[InformationValues]
(
	[SheetID] ASC,
	[InfoTemplateID] ASC,
	[RevisionID] DESC
)
INCLUDE([InfoValue],[UOM]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_InformationValues_ValueSetID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_InformationValues_ValueSetID] ON [dbo].[InformationValues]
(
	[ValueSetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_InfoValues_Sheet_Tpl]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_InfoValues_Sheet_Tpl] ON [dbo].[InformationValues]
(
	[SheetID] ASC,
	[InfoTemplateID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [UX_InfoValues_Sheet_InfoTemplate_Legacy]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_InfoValues_Sheet_InfoTemplate_Legacy] ON [dbo].[InformationValues]
(
	[SheetID] ASC,
	[InfoTemplateID] ASC
)
WHERE ([ValueSetID] IS NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [UX_InfoValues_ValueSet_InfoTemplate]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_InfoValues_ValueSet_InfoTemplate] ON [dbo].[InformationValues]
(
	[ValueSetID] ASC,
	[InfoTemplateID] ASC
)
WHERE ([ValueSetID] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_InformationValueSets_SheetID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_InformationValueSets_SheetID] ON [dbo].[InformationValueSets]
(
	[SheetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ValueSets_Context]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_ValueSets_Context] ON [dbo].[InformationValueSets]
(
	[ContextID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ValueSets_Sheet]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_ValueSets_Sheet] ON [dbo].[InformationValueSets]
(
	[SheetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [UQ_InformationValueSets_SheetID_ContextID_NullParty]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_InformationValueSets_SheetID_ContextID_NullParty] ON [dbo].[InformationValueSets]
(
	[SheetID] ASC,
	[ContextID] ASC
)
WHERE ([PartyID] IS NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [UQ_InformationValueSets_SheetID_ContextID_PartyID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_InformationValueSets_SheetID_ContextID_PartyID] ON [dbo].[InformationValueSets]
(
	[SheetID] ASC,
	[ContextID] ASC,
	[PartyID] ASC
)
WHERE ([PartyID] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [UX_ValueSets_Sheet_Context_NoParty]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_ValueSets_Sheet_Context_NoParty] ON [dbo].[InformationValueSets]
(
	[SheetID] ASC,
	[ContextID] ASC
)
WHERE ([PartyID] IS NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [UX_ValueSets_Sheet_Context_Party]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_ValueSets_Sheet_Context_Party] ON [dbo].[InformationValueSets]
(
	[SheetID] ASC,
	[ContextID] ASC,
	[PartyID] ASC
)
WHERE ([PartyID] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_InfoTemplateGrouping_GroupKey]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_InfoTemplateGrouping_GroupKey] ON [dbo].[InfoTemplateGrouping]
(
	[GroupKey] ASC,
	[CellIndex] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_InstrumentDatasheetLinks_Account_Sheet]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_InstrumentDatasheetLinks_Account_Sheet] ON [dbo].[InstrumentDatasheetLinks]
(
	[AccountID] ASC,
	[SheetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ARITHABORT ON
SET CONCAT_NULL_YIELDS_NULL ON
SET QUOTED_IDENTIFIER ON
SET ANSI_NULLS ON
SET ANSI_PADDING ON
SET ANSI_WARNINGS ON
SET NUMERIC_ROUNDABORT OFF
GO
/****** Object:  Index [UX_InstrumentDatasheetLinks_Unique]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_InstrumentDatasheetLinks_Unique] ON [dbo].[InstrumentDatasheetLinks]
(
	[InstrumentID] ASC,
	[SheetID] ASC,
	[LinkRoleKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_InstrumentLoopMembers_Account_Loop]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_InstrumentLoopMembers_Account_Loop] ON [dbo].[InstrumentLoopMembers]
(
	[AccountID] ASC,
	[LoopID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [UX_InstrumentLoopMembers_Unique]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_InstrumentLoopMembers_Unique] ON [dbo].[InstrumentLoopMembers]
(
	[LoopID] ASC,
	[InstrumentID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_InstrumentLoops_Account_LoopTag]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_InstrumentLoops_Account_LoopTag] ON [dbo].[InstrumentLoops]
(
	[AccountID] ASC,
	[LoopTag] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_InstrumentLoops_Account_LoopTagNorm]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_InstrumentLoops_Account_LoopTagNorm] ON [dbo].[InstrumentLoops]
(
	[AccountID] ASC,
	[LoopTagNorm] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_InstrumentLoops_Account_LoopTagNorm]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_InstrumentLoops_Account_LoopTagNorm] ON [dbo].[InstrumentLoops]
(
	[AccountID] ASC,
	[LoopTagNorm] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_InstrumentLoops_LoopTag]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_InstrumentLoops_LoopTag] ON [dbo].[InstrumentLoops]
(
	[LoopTag] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Instruments_Account_Tag]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Instruments_Account_Tag] ON [dbo].[Instruments]
(
	[AccountID] ASC,
	[InstrumentTag] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Instruments_Account_Type]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Instruments_Account_Type] ON [dbo].[Instruments]
(
	[AccountID] ASC,
	[InstrumentType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_Instruments_Account_TagNorm]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_Instruments_Account_TagNorm] ON [dbo].[Instruments]
(
	[AccountID] ASC,
	[InstrumentTagNorm] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_InstrumentTagRules_Account_Active]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_InstrumentTagRules_Account_Active] ON [dbo].[InstrumentTagRules]
(
	[AccountID] ASC,
	[IsActive] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_InventoryItems_AccountID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_InventoryItems_AccountID] ON [dbo].[InventoryItems]
(
	[AccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_InventoryTransactions_InventoryID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_InventoryTransactions_InventoryID] ON [dbo].[InventoryTransactions]
(
	[InventoryID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_InventoryTransactions_PerformedAt_TransactionID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_InventoryTransactions_PerformedAt_TransactionID] ON [dbo].[InventoryTransactions]
(
	[PerformedAt] DESC,
	[TransactionID] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_InventoryTransactions_TransactionType]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_InventoryTransactions_TransactionType] ON [dbo].[InventoryTransactions]
(
	[TransactionType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_LayoutBlocks_Region_Order]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_LayoutBlocks_Region_Order] ON [dbo].[LayoutBlocks]
(
	[RegionID] ASC,
	[OrderIndex] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_LayoutBodySlots_Layout]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_LayoutBodySlots_Layout] ON [dbo].[LayoutBodySlots]
(
	[LayoutID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_LBS_Layout_Subsheet]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_LBS_Layout_Subsheet] ON [dbo].[LayoutBodySlots]
(
	[LayoutID] ASC,
	[SubsheetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_LayoutRegions_LayoutID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_LayoutRegions_LayoutID] ON [dbo].[LayoutRegions]
(
	[LayoutID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ARITHABORT ON
SET CONCAT_NULL_YIELDS_NULL ON
SET QUOTED_IDENTIFIER ON
SET ANSI_NULLS ON
SET ANSI_PADDING ON
SET ANSI_WARNINGS ON
SET NUMERIC_ROUNDABORT OFF
GO
/****** Object:  Index [IX_LayoutSubsheetSlots_ColumnOrder]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_LayoutSubsheetSlots_ColumnOrder] ON [dbo].[LayoutSubsheetSlots]
(
	[LayoutID] ASC,
	[SubsheetID] ASC,
	[ColumnNumberNorm] ASC,
	[OrderInColumn] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_LSS_Layout_InfoTemplate]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_LSS_Layout_InfoTemplate] ON [dbo].[LayoutSubsheetSlots]
(
	[LayoutID] ASC,
	[InfoTemplateID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_LSS_Layout_Sub]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_LSS_Layout_Sub] ON [dbo].[LayoutSubsheetSlots]
(
	[LayoutID] ASC,
	[SubsheetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_LSS_Layout_Subsheet]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_LSS_Layout_Subsheet] ON [dbo].[LayoutSubsheetSlots]
(
	[LayoutID] ASC,
	[SubsheetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_LifecycleStates_SortOrder]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_LifecycleStates_SortOrder] ON [dbo].[LifecycleStates]
(
	[SortOrder] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_LifecycleStates_Code]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_LifecycleStates_Code] ON [dbo].[LifecycleStates]
(
	[Code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_LoopInstruments_Account_Loop]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_LoopInstruments_Account_Loop] ON [dbo].[LoopInstruments]
(
	[AccountID] ASC,
	[LoopID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_LoopInstruments_Asset]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_LoopInstruments_Asset] ON [dbo].[LoopInstruments]
(
	[AssetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_LoopInstruments_Loop]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_LoopInstruments_Loop] ON [dbo].[LoopInstruments]
(
	[LoopID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_LoopInstruments_Sheet]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_LoopInstruments_Sheet] ON [dbo].[LoopInstruments]
(
	[SheetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_LoopInstruments_Loop_Role_Asset]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_LoopInstruments_Loop_Role_Asset] ON [dbo].[LoopInstruments]
(
	[LoopID] ASC,
	[Role] ASC,
	[AssetID] ASC
)
WHERE ([AssetID] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_LoopInstruments_Loop_Role_Sheet]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_LoopInstruments_Loop_Role_Sheet] ON [dbo].[LoopInstruments]
(
	[LoopID] ASC,
	[Role] ASC,
	[SheetID] ASC
)
WHERE ([SheetID] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Manufacturers_AccountID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Manufacturers_AccountID] ON [dbo].[Manufacturers]
(
	[AccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_Manufacturers_AccountID_ManuName]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Manufacturers_AccountID_ManuName] ON [dbo].[Manufacturers]
(
	[AccountID] ASC,
	[ManuName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_Manufacturers_Name]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_Manufacturers_Name] ON [dbo].[Manufacturers]
(
	[ManuName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Notifications_AccountID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Notifications_AccountID] ON [dbo].[Notifications]
(
	[AccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Parties_PartyType]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Parties_PartyType] ON [dbo].[Parties]
(
	[PartyType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Parties_Status]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Parties_Status] ON [dbo].[Parties]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_Permissions_PermissionKey]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_Permissions_PermissionKey] ON [dbo].[Permissions]
(
	[PermissionKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_PlatformAdmins_CreatedAt]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_PlatformAdmins_CreatedAt] ON [dbo].[PlatformAdmins]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_PlatformAdmins_IsActive]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_PlatformAdmins_IsActive] ON [dbo].[PlatformAdmins]
(
	[IsActive] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [UX_PlatformAdmins_OneActivePerUser]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_PlatformAdmins_OneActivePerUser] ON [dbo].[PlatformAdmins]
(
	[UserID] ASC
)
WHERE ([IsActive]=(1))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Projects_AccountID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Projects_AccountID] ON [dbo].[Projects]
(
	[AccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_Projects_AccountID_ProjNum]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Projects_AccountID_ProjNum] ON [dbo].[Projects]
(
	[AccountID] ASC,
	[ProjNum] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RatingsBlocks_BlockType]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_RatingsBlocks_BlockType] ON [dbo].[RatingsBlocks]
(
	[BlockType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_RatingsBlocks_Sheet]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_RatingsBlocks_Sheet] ON [dbo].[RatingsBlocks]
(
	[SheetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_RatingsEntries_Block]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_RatingsEntries_Block] ON [dbo].[RatingsEntries]
(
	[RatingsBlockID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_RatingsEntries_Block_Key]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_RatingsEntries_Block_Key] ON [dbo].[RatingsEntries]
(
	[RatingsBlockID] ASC,
	[Key] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_Roles_RoleName]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_Roles_RoleName] ON [dbo].[Roles]
(
	[RoleName] ASC
)
WHERE ([RoleName] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ScheduleColumns_Schedule_Order]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_ScheduleColumns_Schedule_Order] ON [dbo].[ScheduleColumns]
(
	[AccountID] ASC,
	[ScheduleID] ASC,
	[DisplayOrder] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_ScheduleColumns_Schedule_Key]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_ScheduleColumns_Schedule_Key] ON [dbo].[ScheduleColumns]
(
	[AccountID] ASC,
	[ScheduleID] ASC,
	[ColumnKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ScheduleEntries_Account_Schedule]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_ScheduleEntries_Account_Schedule] ON [dbo].[ScheduleEntries]
(
	[AccountID] ASC,
	[ScheduleID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ScheduleEntries_Asset]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_ScheduleEntries_Asset] ON [dbo].[ScheduleEntries]
(
	[AssetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ScheduleEntries_Schedule]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_ScheduleEntries_Schedule] ON [dbo].[ScheduleEntries]
(
	[ScheduleID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ScheduleEntries_Sheet]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_ScheduleEntries_Sheet] ON [dbo].[ScheduleEntries]
(
	[SheetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [UX_ScheduleEntries_Account_Schedule_Asset]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_ScheduleEntries_Account_Schedule_Asset] ON [dbo].[ScheduleEntries]
(
	[AccountID] ASC,
	[ScheduleID] ASC,
	[AssetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ScheduleEntryValues_Account_Column]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_ScheduleEntryValues_Account_Column] ON [dbo].[ScheduleEntryValues]
(
	[AccountID] ASC,
	[ScheduleColumnID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [UX_ScheduleEntryValues_Entry_Column]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_ScheduleEntryValues_Entry_Column] ON [dbo].[ScheduleEntryValues]
(
	[AccountID] ASC,
	[ScheduleEntryID] ASC,
	[ScheduleColumnID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Schedules_Account_Client_Project]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Schedules_Account_Client_Project] ON [dbo].[Schedules]
(
	[AccountID] ASC,
	[ClientID] ASC,
	[ProjectID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Schedules_Client_Project]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Schedules_Client_Project] ON [dbo].[Schedules]
(
	[ClientID] ASC,
	[ProjectID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Schedules_Discipline_Subtype]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Schedules_Discipline_Subtype] ON [dbo].[Schedules]
(
	[DisciplineID] ASC,
	[SubtypeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Sessions_UserID_AccountID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Sessions_UserID_AccountID] ON [dbo].[Sessions]
(
	[UserID] ASC,
	[AccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SheetAttachments_SheetID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_SheetAttachments_SheetID] ON [dbo].[SheetAttachments]
(
	[SheetID] ASC,
	[OrderIndex] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SheetHeaderKV_Sheet]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_SheetHeaderKV_Sheet] ON [dbo].[SheetHeaderKV]
(
	[SheetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SheetNotes_SheetID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_SheetNotes_SheetID] ON [dbo].[SheetNotes]
(
	[SheetID] ASC,
	[OrderIndex] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SheetRevisions_Sheet_SystemRevisionNum_Desc]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_SheetRevisions_Sheet_SystemRevisionNum_Desc] ON [dbo].[SheetRevisions]
(
	[SheetID] ASC,
	[SystemRevisionNum] DESC
)
WHERE ([SheetID] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SheetRevisions_SheetID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_SheetRevisions_SheetID] ON [dbo].[SheetRevisions]
(
	[SheetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SheetRevisions_SheetID_RevisionNum]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_SheetRevisions_SheetID_RevisionNum] ON [dbo].[SheetRevisions]
(
	[SheetID] ASC,
	[RevisionNum] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [UX_SheetRevisions_Sheet_SystemRevisionNum]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_SheetRevisions_Sheet_SystemRevisionNum] ON [dbo].[SheetRevisions]
(
	[SheetID] ASC,
	[SystemRevisionNum] ASC
)
WHERE ([SheetID] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Sheets_AccountID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Sheets_AccountID] ON [dbo].[Sheets]
(
	[AccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Sheets_AccountID_Status]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Sheets_AccountID_Status] ON [dbo].[Sheets]
(
	[AccountID] ASC,
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Sheets_AssetID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Sheets_AssetID] ON [dbo].[Sheets]
(
	[AssetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Sheets_DisciplineID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Sheets_DisciplineID] ON [dbo].[Sheets]
(
	[DisciplineID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Sheets_SubtypeID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Sheets_SubtypeID] ON [dbo].[Sheets]
(
	[SubtypeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SheetTemplates_DisciplineID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_SheetTemplates_DisciplineID] ON [dbo].[SheetTemplates]
(
	[DisciplineID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SheetTemplates_SubtypeID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_SheetTemplates_SubtypeID] ON [dbo].[SheetTemplates]
(
	[SubtypeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Suppliers_AccountID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Suppliers_AccountID] ON [dbo].[Suppliers]
(
	[AccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_Suppliers_AccountID_SuppCode]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Suppliers_AccountID_SuppCode] ON [dbo].[Suppliers]
(
	[AccountID] ASC,
	[SuppCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_Suppliers_Code]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_Suppliers_Code] ON [dbo].[Suppliers]
(
	[SuppCode] ASC
)
WHERE ([SuppCode] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SIS_AccountID_StartedAt]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_SIS_AccountID_StartedAt] ON [dbo].[SupportImpersonationSessions]
(
	[AccountID] ASC,
	[StartedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SIS_PlatformUserID_StartedAt]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_SIS_PlatformUserID_StartedAt] ON [dbo].[SupportImpersonationSessions]
(
	[PlatformUserID] ASC,
	[StartedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_TemplateChangeLogs_SheetID_Date]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_TemplateChangeLogs_SheetID_Date] ON [dbo].[TemplateChangeLogs]
(
	[SheetID] ASC,
	[ChangeDate] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_UserActiveAccount_AccountID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_UserActiveAccount_AccountID] ON [dbo].[UserActiveAccount]
(
	[AccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Users_IsPlatformSuperadmin]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Users_IsPlatformSuperadmin] ON [dbo].[Users]
(
	[IsPlatformSuperadmin] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_ValueContexts_Code]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_ValueContexts_Code] ON [dbo].[ValueContexts]
(
	[Code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_VerificationRecordAttachments_AttachmentID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_VerificationRecordAttachments_AttachmentID] ON [dbo].[VerificationRecordAttachments]
(
	[AttachmentID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_VerificationRecordLinks_AccountID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_VerificationRecordLinks_AccountID] ON [dbo].[VerificationRecordLinks]
(
	[AccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_VerificationRecordLinks_SheetID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_VerificationRecordLinks_SheetID] ON [dbo].[VerificationRecordLinks]
(
	[SheetID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_VerificationRecordLinks_VerificationRecordID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_VerificationRecordLinks_VerificationRecordID] ON [dbo].[VerificationRecordLinks]
(
	[VerificationRecordID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_VerificationRecords_IssuedAt]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_VerificationRecords_IssuedAt] ON [dbo].[VerificationRecords]
(
	[IssuedAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_VerificationRecords_Issuer]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_VerificationRecords_Issuer] ON [dbo].[VerificationRecords]
(
	[IssuerPartyID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_VerificationRecords_Type]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_VerificationRecords_Type] ON [dbo].[VerificationRecords]
(
	[VerificationTypeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_VerificationRecordTypes_Discipline]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_VerificationRecordTypes_Discipline] ON [dbo].[VerificationRecordTypes]
(
	[DisciplineID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_VerificationRecordTypes_Code]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_VerificationRecordTypes_Code] ON [dbo].[VerificationRecordTypes]
(
	[Code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Warehouses_AccountID]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE NONCLUSTERED INDEX [IX_Warehouses_AccountID] ON [dbo].[Warehouses]
(
	[AccountID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_Warehouses_AccountID_WarehouseName]    Script Date: 2/12/2026 2:20:15 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Warehouses_AccountID_WarehouseName] ON [dbo].[Warehouses]
(
	[AccountID] ASC,
	[WarehouseName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[AccountInvites] ADD  DEFAULT (N'Pending') FOR [Status]
GO
ALTER TABLE [dbo].[AccountInvites] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AccountInvites] ADD  DEFAULT (getdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[AccountInvites] ADD  DEFAULT ((1)) FOR [SendCount]
GO
ALTER TABLE [dbo].[AccountMembers] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[AccountMembers] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AccountMembers] ADD  DEFAULT (getdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[AccountMembers] ADD  CONSTRAINT [DF_AccountMembers_IsOwner]  DEFAULT ((0)) FOR [IsOwner]
GO
ALTER TABLE [dbo].[AccountOwnershipTransfers] ADD  CONSTRAINT [DF_AOT_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Accounts] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Accounts] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Accounts] ADD  DEFAULT (getdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Assets] ADD  CONSTRAINT [DF_Assets_Status]  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[Assets] ADD  CONSTRAINT [DF_Assets_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Assets] ADD  CONSTRAINT [DF_Assets_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Attachments] ADD  DEFAULT ('local') FOR [StorageProvider]
GO
ALTER TABLE [dbo].[Attachments] ADD  DEFAULT (sysutcdatetime()) FOR [UploadedAt]
GO
ALTER TABLE [dbo].[Attachments] ADD  DEFAULT ((1)) FOR [Version]
GO
ALTER TABLE [dbo].[AuditLogs] ADD  CONSTRAINT [DF_AuditLogs_LogID]  DEFAULT (NEXT VALUE FOR [dbo].[AuditLogIdSeq]) FOR [LogID]
GO
ALTER TABLE [dbo].[ChangeLogs] ADD  DEFAULT (sysutcdatetime()) FOR [ChangeDate]
GO
ALTER TABLE [dbo].[Clients] ADD  CONSTRAINT [DF_Clients_ClientID]  DEFAULT (NEXT VALUE FOR [dbo].[Seq_Clients]) FOR [ClientID]
GO
ALTER TABLE [dbo].[Clients] ADD  CONSTRAINT [DF_Clients_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Clients] ADD  CONSTRAINT [DF_Clients_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DatasheetLayouts] ADD  DEFAULT ('A4') FOR [PaperSize]
GO
ALTER TABLE [dbo].[DatasheetLayouts] ADD  DEFAULT ('portrait') FOR [Orientation]
GO
ALTER TABLE [dbo].[DatasheetLayouts] ADD  DEFAULT ((24)) FOR [GridCols]
GO
ALTER TABLE [dbo].[DatasheetLayouts] ADD  DEFAULT ((2.0)) FOR [GridGapMm]
GO
ALTER TABLE [dbo].[DatasheetLayouts] ADD  DEFAULT ((12.7)) FOR [MarginTopMm]
GO
ALTER TABLE [dbo].[DatasheetLayouts] ADD  DEFAULT ((12.7)) FOR [MarginRightMm]
GO
ALTER TABLE [dbo].[DatasheetLayouts] ADD  DEFAULT ((12.7)) FOR [MarginBottomMm]
GO
ALTER TABLE [dbo].[DatasheetLayouts] ADD  DEFAULT ((12.7)) FOR [MarginLeftMm]
GO
ALTER TABLE [dbo].[DatasheetLayouts] ADD  DEFAULT ((1)) FOR [Version]
GO
ALTER TABLE [dbo].[DatasheetLayouts] ADD  DEFAULT ((0)) FOR [IsDefault]
GO
ALTER TABLE [dbo].[DatasheetLayouts] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DatasheetLayouts] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DatasheetSubtypes] ADD  CONSTRAINT [DF_DatasheetSubtypes_Status]  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[DatasheetSubtypes] ADD  CONSTRAINT [DF_DatasheetSubtypes_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DatasheetSubtypes] ADD  CONSTRAINT [DF_DatasheetSubtypes_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DisciplinePacks] ADD  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[DisciplinePackTemplates] ADD  DEFAULT ((0)) FOR [IsDefault]
GO
ALTER TABLE [dbo].[Disciplines] ADD  CONSTRAINT [DF_Disciplines_Status]  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[Disciplines] ADD  CONSTRAINT [DF_Disciplines_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Disciplines] ADD  CONSTRAINT [DF_Disciplines_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[EntityLinks] ADD  CONSTRAINT [DF_EntityLinks_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ExportJobs] ADD  DEFAULT ((0)) FOR [Progress]
GO
ALTER TABLE [dbo].[ExportJobs] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[InformationValueSets] ADD  CONSTRAINT [DF_InformationValueSets_Status]  DEFAULT ('Draft') FOR [Status]
GO
ALTER TABLE [dbo].[InformationValueSets] ADD  CONSTRAINT [DF_InformationValueSets_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[InformationValueSets] ADD  CONSTRAINT [DF_InformationValueSets_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[InfoTemplateTranslations] ADD  DEFAULT ((0)) FOR [IsMachineTranslated]
GO
ALTER TABLE [dbo].[InstrumentDatasheetLinks] ADD  CONSTRAINT [DF_InstrumentDatasheetLinks_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[InstrumentLoopMembers] ADD  CONSTRAINT [DF_InstrumentLoopMembers_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[InstrumentLoops] ADD  CONSTRAINT [DF_InstrumentLoops_Status]  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[InstrumentLoops] ADD  CONSTRAINT [DF_InstrumentLoops_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[InstrumentLoops] ADD  CONSTRAINT [DF_InstrumentLoops_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Instruments] ADD  CONSTRAINT [DF_Instruments_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Instruments] ADD  CONSTRAINT [DF_Instruments_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[InstrumentTagRules] ADD  CONSTRAINT [DF_InstrumentTagRules_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[InstrumentTagRules] ADD  CONSTRAINT [DF_InstrumentTagRules_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[InstrumentTagRules] ADD  CONSTRAINT [DF_InstrumentTagRules_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[InventoryAuditLogs] ADD  DEFAULT (getdate()) FOR [ChangedAt]
GO
ALTER TABLE [dbo].[InventoryMaintenanceLogs] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[InventoryTransactions] ADD  DEFAULT (getdate()) FOR [PerformedAt]
GO
ALTER TABLE [dbo].[LayoutBindings] ADD  DEFAULT ((0)) FOR [PageBreakBefore]
GO
ALTER TABLE [dbo].[LayoutBindings] ADD  DEFAULT ((0)) FOR [KeepWithNext]
GO
ALTER TABLE [dbo].[LayoutBlocks] ADD  DEFAULT ((0)) FOR [X]
GO
ALTER TABLE [dbo].[LayoutBlocks] ADD  DEFAULT ((0)) FOR [Y]
GO
ALTER TABLE [dbo].[LayoutBlocks] ADD  DEFAULT ((6)) FOR [W]
GO
ALTER TABLE [dbo].[LayoutBlocks] ADD  DEFAULT ((1)) FOR [H]
GO
ALTER TABLE [dbo].[LayoutBlocks] ADD  DEFAULT ((0)) FOR [OrderIndex]
GO
ALTER TABLE [dbo].[LayoutBodySlots] ADD  CONSTRAINT [DF_LBS_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LayoutBodySlots] ADD  CONSTRAINT [DF_LBS_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[LayoutBodySlots] ADD  CONSTRAINT [DF_LBS_Width]  DEFAULT ((1)) FOR [Width]
GO
ALTER TABLE [dbo].[LayoutRegions] ADD  DEFAULT ((0)) FOR [X]
GO
ALTER TABLE [dbo].[LayoutRegions] ADD  DEFAULT ((0)) FOR [Y]
GO
ALTER TABLE [dbo].[LayoutRegions] ADD  DEFAULT ((24)) FOR [W]
GO
ALTER TABLE [dbo].[LayoutRegions] ADD  DEFAULT ((1)) FOR [H]
GO
ALTER TABLE [dbo].[LayoutRegions] ADD  DEFAULT ((0)) FOR [OrderIndex]
GO
ALTER TABLE [dbo].[LayoutSubsheetSlots] ADD  CONSTRAINT [DF_LSS_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LayoutSubsheetSlots] ADD  CONSTRAINT [DF_LSS_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[LifecycleStates] ADD  CONSTRAINT [DF_LifecycleStates_SortOrder]  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[LifecycleStates] ADD  CONSTRAINT [DF_LifecycleStates_IsTerminal]  DEFAULT ((0)) FOR [IsTerminal]
GO
ALTER TABLE [dbo].[LifecycleStates] ADD  CONSTRAINT [DF_LifecycleStates_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LifecycleStates] ADD  CONSTRAINT [DF_LifecycleStates_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[LoopInstruments] ADD  CONSTRAINT [DF_LoopInstruments_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Manufacturers] ADD  CONSTRAINT [DF_Manufacturers_ManuID]  DEFAULT (NEXT VALUE FOR [dbo].[Seq_Manufacturers]) FOR [ManuID]
GO
ALTER TABLE [dbo].[Manufacturers] ADD  CONSTRAINT [DF_Manufacturers_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Manufacturers] ADD  CONSTRAINT [DF_Manufacturers_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[MirrorTemplates] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[MirrorTemplates] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Parties] ADD  CONSTRAINT [DF_Parties_Status]  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[Parties] ADD  CONSTRAINT [DF_Parties_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Parties] ADD  CONSTRAINT [DF_Parties_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[PlatformAdmins] ADD  CONSTRAINT [DF_PlatformAdmins_PlatformAdminID]  DEFAULT (newid()) FOR [PlatformAdminID]
GO
ALTER TABLE [dbo].[PlatformAdmins] ADD  CONSTRAINT [DF_PlatformAdmins_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[PlatformAdmins] ADD  CONSTRAINT [DF_PlatformAdmins_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Projects] ADD  CONSTRAINT [DF_Projects_ProjectID]  DEFAULT (NEXT VALUE FOR [dbo].[Seq_Projects]) FOR [ProjectID]
GO
ALTER TABLE [dbo].[Projects] ADD  CONSTRAINT [DF_Projects_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Projects] ADD  CONSTRAINT [DF_Projects_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RatingsBlocks] ADD  CONSTRAINT [DF_RatingsBlocks_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RatingsBlocks] ADD  CONSTRAINT [DF_RatingsBlocks_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RatingsEntries] ADD  CONSTRAINT [DF_RatingsEntries_OrderIndex]  DEFAULT ((0)) FOR [OrderIndex]
GO
ALTER TABLE [dbo].[Roles] ADD  CONSTRAINT [DF_Roles_RoleID]  DEFAULT (NEXT VALUE FOR [dbo].[Seq_Roles]) FOR [RoleID]
GO
ALTER TABLE [dbo].[Roles] ADD  CONSTRAINT [DF_Roles_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Roles] ADD  CONSTRAINT [DF_Roles_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[ScheduleColumns] ADD  CONSTRAINT [DF_ScheduleColumns_DisplayOrder]  DEFAULT ((0)) FOR [DisplayOrder]
GO
ALTER TABLE [dbo].[ScheduleColumns] ADD  CONSTRAINT [DF_ScheduleColumns_IsRequired]  DEFAULT ((0)) FOR [IsRequired]
GO
ALTER TABLE [dbo].[ScheduleColumns] ADD  CONSTRAINT [DF_ScheduleColumns_IsEditable]  DEFAULT ((1)) FOR [IsEditable]
GO
ALTER TABLE [dbo].[ScheduleColumns] ADD  CONSTRAINT [DF_ScheduleColumns_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ScheduleEntries] ADD  CONSTRAINT [DF_ScheduleEntries_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ScheduleEntryValues] ADD  CONSTRAINT [DF_ScheduleEntryValues_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Schedules] ADD  CONSTRAINT [DF_Schedules_Scope]  DEFAULT ('Project') FOR [Scope]
GO
ALTER TABLE [dbo].[Schedules] ADD  CONSTRAINT [DF_Schedules_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Schedules] ADD  CONSTRAINT [DF_Schedules_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SheetAttachments] ADD  DEFAULT ((0)) FOR [OrderIndex]
GO
ALTER TABLE [dbo].[SheetAttachments] ADD  DEFAULT ((0)) FOR [IsFromTemplate]
GO
ALTER TABLE [dbo].[SheetAttachments] ADD  DEFAULT ((0)) FOR [CloneOnCreate]
GO
ALTER TABLE [dbo].[SheetAttachments] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SheetNotes] ADD  CONSTRAINT [DF_SheetNotes_New_OrderIndex]  DEFAULT ((0)) FOR [OrderIndex]
GO
ALTER TABLE [dbo].[SheetNotes] ADD  CONSTRAINT [DF_SheetNotes_New_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SheetRevisions] ADD  CONSTRAINT [DF_SheetRevisions_IsCurrent]  DEFAULT ((0)) FOR [IsCurrent]
GO
ALTER TABLE [dbo].[Sheets] ADD  CONSTRAINT [DF_Sheets_IsSuperseded]  DEFAULT ((0)) FOR [IsSuperseded]
GO
ALTER TABLE [dbo].[SheetTranslations] ADD  DEFAULT ((0)) FOR [IsMachineTranslated]
GO
ALTER TABLE [dbo].[SubsheetTranslations] ADD  DEFAULT ((0)) FOR [IsMachineTranslated]
GO
ALTER TABLE [dbo].[Suppliers] ADD  CONSTRAINT [DF_Suppliers_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Suppliers] ADD  CONSTRAINT [DF_Suppliers_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SupportImpersonationSessions] ADD  CONSTRAINT [DF_SIS_SessionID]  DEFAULT (newid()) FOR [SessionID]
GO
ALTER TABLE [dbo].[SupportImpersonationSessions] ADD  CONSTRAINT [DF_SIS_StartedAt]  DEFAULT (sysutcdatetime()) FOR [StartedAt]
GO
ALTER TABLE [dbo].[TemplateChangeLogs] ADD  DEFAULT (sysutcdatetime()) FOR [ChangeDate]
GO
ALTER TABLE [dbo].[UserActiveAccount] ADD  DEFAULT (getdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Users] ADD  CONSTRAINT [DF_Users_IsPlatformSuperadmin]  DEFAULT ((0)) FOR [IsPlatformSuperadmin]
GO
ALTER TABLE [dbo].[ValueContexts] ADD  CONSTRAINT [DF_ValueContexts_SortOrder]  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[ValueContexts] ADD  CONSTRAINT [DF_ValueContexts_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ValueContexts] ADD  CONSTRAINT [DF_ValueContexts_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[VerificationRecords] ADD  CONSTRAINT [DF_VerificationRecords_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[VerificationRecords] ADD  CONSTRAINT [DF_VerificationRecords_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[VerificationRecordTypes] ADD  CONSTRAINT [DF_VerificationRecordTypes_Status]  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[VerificationRecordTypes] ADD  CONSTRAINT [DF_VerificationRecordTypes_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[VerificationRecordTypes] ADD  CONSTRAINT [DF_VerificationRecordTypes_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[AccountInvites]  WITH NOCHECK ADD  CONSTRAINT [FK_AccountInvites_AcceptedByUserID] FOREIGN KEY([AcceptedByUserID])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[AccountInvites] CHECK CONSTRAINT [FK_AccountInvites_AcceptedByUserID]
GO
ALTER TABLE [dbo].[AccountInvites]  WITH CHECK ADD  CONSTRAINT [FK_AccountInvites_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AccountInvites] CHECK CONSTRAINT [FK_AccountInvites_AccountID]
GO
ALTER TABLE [dbo].[AccountInvites]  WITH NOCHECK ADD  CONSTRAINT [FK_AccountInvites_InvitedByUserID] FOREIGN KEY([InvitedByUserID])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[AccountInvites] CHECK CONSTRAINT [FK_AccountInvites_InvitedByUserID]
GO
ALTER TABLE [dbo].[AccountInvites]  WITH NOCHECK ADD  CONSTRAINT [FK_AccountInvites_RevokedByUserID] FOREIGN KEY([RevokedByUserID])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[AccountInvites] CHECK CONSTRAINT [FK_AccountInvites_RevokedByUserID]
GO
ALTER TABLE [dbo].[AccountInvites]  WITH CHECK ADD  CONSTRAINT [FK_AccountInvites_RoleID] FOREIGN KEY([RoleID])
REFERENCES [dbo].[Roles] ([RoleID])
GO
ALTER TABLE [dbo].[AccountInvites] CHECK CONSTRAINT [FK_AccountInvites_RoleID]
GO
ALTER TABLE [dbo].[AccountMembers]  WITH CHECK ADD  CONSTRAINT [FK_AccountMembers_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AccountMembers] CHECK CONSTRAINT [FK_AccountMembers_AccountID]
GO
ALTER TABLE [dbo].[AccountMembers]  WITH CHECK ADD  CONSTRAINT [FK_AccountMembers_RoleID] FOREIGN KEY([RoleID])
REFERENCES [dbo].[Roles] ([RoleID])
GO
ALTER TABLE [dbo].[AccountMembers] CHECK CONSTRAINT [FK_AccountMembers_RoleID]
GO
ALTER TABLE [dbo].[AccountMembers]  WITH NOCHECK ADD  CONSTRAINT [FK_AccountMembers_UserID] FOREIGN KEY([UserID])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[AccountMembers] CHECK CONSTRAINT [FK_AccountMembers_UserID]
GO
ALTER TABLE [dbo].[AccountOwnershipTransfers]  WITH CHECK ADD  CONSTRAINT [FK_AOT_AccountID_Accounts] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[AccountOwnershipTransfers] CHECK CONSTRAINT [FK_AOT_AccountID_Accounts]
GO
ALTER TABLE [dbo].[AccountOwnershipTransfers]  WITH NOCHECK ADD  CONSTRAINT [FK_AOT_FromUserID_Users] FOREIGN KEY([FromUserID])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[AccountOwnershipTransfers] CHECK CONSTRAINT [FK_AOT_FromUserID_Users]
GO
ALTER TABLE [dbo].[AccountOwnershipTransfers]  WITH NOCHECK ADD  CONSTRAINT [FK_AOT_RequestedByUserID_Users] FOREIGN KEY([RequestedByUserID])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[AccountOwnershipTransfers] CHECK CONSTRAINT [FK_AOT_RequestedByUserID_Users]
GO
ALTER TABLE [dbo].[AccountOwnershipTransfers]  WITH NOCHECK ADD  CONSTRAINT [FK_AOT_ToUserID_Users] FOREIGN KEY([ToUserID])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[AccountOwnershipTransfers] CHECK CONSTRAINT [FK_AOT_ToUserID_Users]
GO
ALTER TABLE [dbo].[Accounts]  WITH NOCHECK ADD  CONSTRAINT [FK_Accounts_OwnerUserID_Users_UserID] FOREIGN KEY([OwnerUserID])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[Accounts] CHECK CONSTRAINT [FK_Accounts_OwnerUserID_Users_UserID]
GO
ALTER TABLE [dbo].[Areas]  WITH CHECK ADD  CONSTRAINT [FK_Areas_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Areas] CHECK CONSTRAINT [FK_Areas_AccountID]
GO
ALTER TABLE [dbo].[Assets]  WITH CHECK ADD  CONSTRAINT [FK_Assets_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Assets] CHECK CONSTRAINT [FK_Assets_AccountID]
GO
ALTER TABLE [dbo].[Assets]  WITH CHECK ADD  CONSTRAINT [FK_Assets_Clients] FOREIGN KEY([ClientID])
REFERENCES [dbo].[Clients] ([ClientID])
GO
ALTER TABLE [dbo].[Assets] CHECK CONSTRAINT [FK_Assets_Clients]
GO
ALTER TABLE [dbo].[Assets]  WITH CHECK ADD  CONSTRAINT [FK_Assets_Disciplines] FOREIGN KEY([DisciplineID])
REFERENCES [dbo].[Disciplines] ([DisciplineID])
GO
ALTER TABLE [dbo].[Assets] CHECK CONSTRAINT [FK_Assets_Disciplines]
GO
ALTER TABLE [dbo].[Assets]  WITH CHECK ADD  CONSTRAINT [FK_Assets_Projects] FOREIGN KEY([ProjectID])
REFERENCES [dbo].[Projects] ([ProjectID])
GO
ALTER TABLE [dbo].[Assets] CHECK CONSTRAINT [FK_Assets_Projects]
GO
ALTER TABLE [dbo].[Assets]  WITH CHECK ADD  CONSTRAINT [FK_Assets_Subtypes] FOREIGN KEY([SubtypeID])
REFERENCES [dbo].[DatasheetSubtypes] ([SubtypeID])
GO
ALTER TABLE [dbo].[Assets] CHECK CONSTRAINT [FK_Assets_Subtypes]
GO
ALTER TABLE [dbo].[Attachments]  WITH CHECK ADD  CONSTRAINT [FK_Attachments_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Attachments] CHECK CONSTRAINT [FK_Attachments_AccountID]
GO
ALTER TABLE [dbo].[AuditLogs]  WITH CHECK ADD  CONSTRAINT [FK_AuditLogs_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[AuditLogs] CHECK CONSTRAINT [FK_AuditLogs_AccountID]
GO
ALTER TABLE [dbo].[ChangeLogs]  WITH CHECK ADD  CONSTRAINT [FK_ChangeLogs_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[ChangeLogs] CHECK CONSTRAINT [FK_ChangeLogs_AccountID]
GO
ALTER TABLE [dbo].[ChangeLogs]  WITH CHECK ADD  CONSTRAINT [FK_ChangeLogs_InfoTemplates] FOREIGN KEY([InfoTemplateID])
REFERENCES [dbo].[InformationTemplates] ([InfoTemplateID])
GO
ALTER TABLE [dbo].[ChangeLogs] CHECK CONSTRAINT [FK_ChangeLogs_InfoTemplates]
GO
ALTER TABLE [dbo].[ChangeLogs]  WITH CHECK ADD  CONSTRAINT [FK_ChangeLogs_Sheets] FOREIGN KEY([SheetID])
REFERENCES [dbo].[Sheets] ([SheetID])
GO
ALTER TABLE [dbo].[ChangeLogs] CHECK CONSTRAINT [FK_ChangeLogs_Sheets]
GO
ALTER TABLE [dbo].[Clients]  WITH CHECK ADD  CONSTRAINT [FK_Clients_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Clients] CHECK CONSTRAINT [FK_Clients_AccountID]
GO
ALTER TABLE [dbo].[DatasheetLayouts]  WITH CHECK ADD  CONSTRAINT [FK_DatasheetLayouts_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[DatasheetLayouts] CHECK CONSTRAINT [FK_DatasheetLayouts_AccountID]
GO
ALTER TABLE [dbo].[DatasheetSubtypes]  WITH CHECK ADD  CONSTRAINT [FK_DatasheetSubtypes_Disciplines] FOREIGN KEY([DisciplineID])
REFERENCES [dbo].[Disciplines] ([DisciplineID])
GO
ALTER TABLE [dbo].[DatasheetSubtypes] CHECK CONSTRAINT [FK_DatasheetSubtypes_Disciplines]
GO
ALTER TABLE [dbo].[EntityLinks]  WITH NOCHECK ADD  CONSTRAINT [FK_EntityLinks_CreatedBy] FOREIGN KEY([CreatedBy])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[EntityLinks] CHECK CONSTRAINT [FK_EntityLinks_CreatedBy]
GO
ALTER TABLE [dbo].[EstimationItems]  WITH CHECK ADD  CONSTRAINT [FK_EstimationItems_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[EstimationItems] CHECK CONSTRAINT [FK_EstimationItems_AccountID]
GO
ALTER TABLE [dbo].[EstimationItemSupplierQuotes]  WITH CHECK ADD  CONSTRAINT [FK_EstimationItemSupplierQuotes_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[EstimationItemSupplierQuotes] CHECK CONSTRAINT [FK_EstimationItemSupplierQuotes_AccountID]
GO
ALTER TABLE [dbo].[EstimationPackages]  WITH CHECK ADD  CONSTRAINT [FK_EstimationPackages_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[EstimationPackages] CHECK CONSTRAINT [FK_EstimationPackages_AccountID]
GO
ALTER TABLE [dbo].[Estimations]  WITH CHECK ADD  CONSTRAINT [FK_Estimations_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Estimations] CHECK CONSTRAINT [FK_Estimations_AccountID]
GO
ALTER TABLE [dbo].[EstimationSuppliers]  WITH CHECK ADD  CONSTRAINT [FK_EstimationSuppliers_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[EstimationSuppliers] CHECK CONSTRAINT [FK_EstimationSuppliers_AccountID]
GO
ALTER TABLE [dbo].[ExportJobs]  WITH CHECK ADD  CONSTRAINT [FK_ExportJobs_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[ExportJobs] CHECK CONSTRAINT [FK_ExportJobs_AccountID]
GO
ALTER TABLE [dbo].[ExportJobs]  WITH NOCHECK ADD  CONSTRAINT [FK_ExportJobs_CreatedBy] FOREIGN KEY([CreatedBy])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[ExportJobs] CHECK CONSTRAINT [FK_ExportJobs_CreatedBy]
GO
ALTER TABLE [dbo].[InformationTemplateOptions]  WITH CHECK ADD  CONSTRAINT [FK_InformationTemplateOptions_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[InformationTemplateOptions] CHECK CONSTRAINT [FK_InformationTemplateOptions_AccountID]
GO
ALTER TABLE [dbo].[InformationTemplates]  WITH CHECK ADD  CONSTRAINT [FK_InformationTemplates_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[InformationTemplates] CHECK CONSTRAINT [FK_InformationTemplates_AccountID]
GO
ALTER TABLE [dbo].[InformationValues]  WITH CHECK ADD  CONSTRAINT [FK_InformationValues_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[InformationValues] CHECK CONSTRAINT [FK_InformationValues_AccountID]
GO
ALTER TABLE [dbo].[InformationValues]  WITH CHECK ADD  CONSTRAINT [FK_InformationValues_ValueSetID] FOREIGN KEY([ValueSetID])
REFERENCES [dbo].[InformationValueSets] ([ValueSetID])
GO
ALTER TABLE [dbo].[InformationValues] CHECK CONSTRAINT [FK_InformationValues_ValueSetID]
GO
ALTER TABLE [dbo].[InformationValues]  WITH CHECK ADD  CONSTRAINT [FK_InformationValues_ValueSets] FOREIGN KEY([ValueSetID])
REFERENCES [dbo].[InformationValueSets] ([ValueSetID])
GO
ALTER TABLE [dbo].[InformationValues] CHECK CONSTRAINT [FK_InformationValues_ValueSets]
GO
ALTER TABLE [dbo].[InformationValueSets]  WITH CHECK ADD  CONSTRAINT [FK_InformationValueSets_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[InformationValueSets] CHECK CONSTRAINT [FK_InformationValueSets_AccountID]
GO
ALTER TABLE [dbo].[InformationValueSets]  WITH CHECK ADD  CONSTRAINT [FK_InformationValueSets_PartyID] FOREIGN KEY([PartyID])
REFERENCES [dbo].[Parties] ([PartyID])
GO
ALTER TABLE [dbo].[InformationValueSets] CHECK CONSTRAINT [FK_InformationValueSets_PartyID]
GO
ALTER TABLE [dbo].[InformationValueSets]  WITH CHECK ADD  CONSTRAINT [FK_ValueSets_Contexts] FOREIGN KEY([ContextID])
REFERENCES [dbo].[ValueContexts] ([ContextID])
GO
ALTER TABLE [dbo].[InformationValueSets] CHECK CONSTRAINT [FK_ValueSets_Contexts]
GO
ALTER TABLE [dbo].[InformationValueSets]  WITH NOCHECK ADD  CONSTRAINT [FK_ValueSets_CreatedBy] FOREIGN KEY([CreatedBy])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[InformationValueSets] CHECK CONSTRAINT [FK_ValueSets_CreatedBy]
GO
ALTER TABLE [dbo].[InformationValueSets]  WITH CHECK ADD  CONSTRAINT [FK_ValueSets_Parties] FOREIGN KEY([PartyID])
REFERENCES [dbo].[Parties] ([PartyID])
GO
ALTER TABLE [dbo].[InformationValueSets] CHECK CONSTRAINT [FK_ValueSets_Parties]
GO
ALTER TABLE [dbo].[InformationValueSets]  WITH CHECK ADD  CONSTRAINT [FK_ValueSets_Sheets] FOREIGN KEY([SheetID])
REFERENCES [dbo].[Sheets] ([SheetID])
GO
ALTER TABLE [dbo].[InformationValueSets] CHECK CONSTRAINT [FK_ValueSets_Sheets]
GO
ALTER TABLE [dbo].[InformationValueSets]  WITH NOCHECK ADD  CONSTRAINT [FK_ValueSets_UpdatedBy] FOREIGN KEY([UpdatedBy])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[InformationValueSets] CHECK CONSTRAINT [FK_ValueSets_UpdatedBy]
GO
ALTER TABLE [dbo].[InfoTemplateGrouping]  WITH CHECK ADD  CONSTRAINT [FK_InfoTemplateGrouping_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[InfoTemplateGrouping] CHECK CONSTRAINT [FK_InfoTemplateGrouping_AccountID]
GO
ALTER TABLE [dbo].[InstrumentDatasheetLinks]  WITH NOCHECK ADD  CONSTRAINT [FK_InstrumentDatasheetLinks_Instruments] FOREIGN KEY([InstrumentID])
REFERENCES [dbo].[Instruments] ([InstrumentID])
GO
ALTER TABLE [dbo].[InstrumentDatasheetLinks] CHECK CONSTRAINT [FK_InstrumentDatasheetLinks_Instruments]
GO
ALTER TABLE [dbo].[InstrumentDatasheetLinks]  WITH NOCHECK ADD  CONSTRAINT [FK_InstrumentDatasheetLinks_Sheets] FOREIGN KEY([SheetID])
REFERENCES [dbo].[Sheets] ([SheetID])
GO
ALTER TABLE [dbo].[InstrumentDatasheetLinks] CHECK CONSTRAINT [FK_InstrumentDatasheetLinks_Sheets]
GO
ALTER TABLE [dbo].[InstrumentLoopMembers]  WITH NOCHECK ADD  CONSTRAINT [FK_InstrumentLoopMembers_Instruments] FOREIGN KEY([InstrumentID])
REFERENCES [dbo].[Instruments] ([InstrumentID])
GO
ALTER TABLE [dbo].[InstrumentLoopMembers] CHECK CONSTRAINT [FK_InstrumentLoopMembers_Instruments]
GO
ALTER TABLE [dbo].[InstrumentLoopMembers]  WITH NOCHECK ADD  CONSTRAINT [FK_InstrumentLoopMembers_Loops] FOREIGN KEY([LoopID])
REFERENCES [dbo].[InstrumentLoops] ([LoopID])
GO
ALTER TABLE [dbo].[InstrumentLoopMembers] CHECK CONSTRAINT [FK_InstrumentLoopMembers_Loops]
GO
ALTER TABLE [dbo].[Inventory]  WITH CHECK ADD  CONSTRAINT [FK_Inventory_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Inventory] CHECK CONSTRAINT [FK_Inventory_AccountID]
GO
ALTER TABLE [dbo].[InventoryAuditLogs]  WITH CHECK ADD  CONSTRAINT [FK_InventoryAuditLogs_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[InventoryAuditLogs] CHECK CONSTRAINT [FK_InventoryAuditLogs_AccountID]
GO
ALTER TABLE [dbo].[InventoryItems]  WITH CHECK ADD  CONSTRAINT [FK_InventoryItems_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[InventoryItems] CHECK CONSTRAINT [FK_InventoryItems_AccountID]
GO
ALTER TABLE [dbo].[InventoryMaintenanceLogs]  WITH CHECK ADD  CONSTRAINT [FK_InventoryMaintenanceLogs_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[InventoryMaintenanceLogs] CHECK CONSTRAINT [FK_InventoryMaintenanceLogs_AccountID]
GO
ALTER TABLE [dbo].[InventoryTransactions]  WITH CHECK ADD  CONSTRAINT [FK_InventoryTransactions_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[InventoryTransactions] CHECK CONSTRAINT [FK_InventoryTransactions_AccountID]
GO
ALTER TABLE [dbo].[LayoutBindings]  WITH CHECK ADD  CONSTRAINT [FK_Bindings_Blocks] FOREIGN KEY([BlockID])
REFERENCES [dbo].[LayoutBlocks] ([BlockID])
GO
ALTER TABLE [dbo].[LayoutBindings] CHECK CONSTRAINT [FK_Bindings_Blocks]
GO
ALTER TABLE [dbo].[LayoutBindings]  WITH CHECK ADD  CONSTRAINT [FK_LayoutBindings_Blocks] FOREIGN KEY([BlockID])
REFERENCES [dbo].[LayoutBlocks] ([BlockID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[LayoutBindings] CHECK CONSTRAINT [FK_LayoutBindings_Blocks]
GO
ALTER TABLE [dbo].[LayoutBlocks]  WITH CHECK ADD  CONSTRAINT [FK_Blocks_Regions] FOREIGN KEY([RegionID])
REFERENCES [dbo].[LayoutRegions] ([RegionID])
GO
ALTER TABLE [dbo].[LayoutBlocks] CHECK CONSTRAINT [FK_Blocks_Regions]
GO
ALTER TABLE [dbo].[LayoutBlocks]  WITH CHECK ADD  CONSTRAINT [FK_LayoutBlocks_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[LayoutBlocks] CHECK CONSTRAINT [FK_LayoutBlocks_AccountID]
GO
ALTER TABLE [dbo].[LayoutBlocks]  WITH CHECK ADD  CONSTRAINT [FK_LayoutBlocks_Regions] FOREIGN KEY([RegionID])
REFERENCES [dbo].[LayoutRegions] ([RegionID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[LayoutBlocks] CHECK CONSTRAINT [FK_LayoutBlocks_Regions]
GO
ALTER TABLE [dbo].[LayoutBodySlots]  WITH CHECK ADD  CONSTRAINT [FK_LayoutBodySlots_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[LayoutBodySlots] CHECK CONSTRAINT [FK_LayoutBodySlots_AccountID]
GO
ALTER TABLE [dbo].[LayoutBodySlots]  WITH CHECK ADD  CONSTRAINT [FK_LBS_DatasheetLayouts] FOREIGN KEY([LayoutID])
REFERENCES [dbo].[DatasheetLayouts] ([LayoutID])
GO
ALTER TABLE [dbo].[LayoutBodySlots] CHECK CONSTRAINT [FK_LBS_DatasheetLayouts]
GO
ALTER TABLE [dbo].[LayoutBodySlots]  WITH CHECK ADD  CONSTRAINT [FK_LBS_Layouts] FOREIGN KEY([LayoutID])
REFERENCES [dbo].[DatasheetLayouts] ([LayoutID])
GO
ALTER TABLE [dbo].[LayoutBodySlots] CHECK CONSTRAINT [FK_LBS_Layouts]
GO
ALTER TABLE [dbo].[LayoutBodySlots]  WITH CHECK ADD  CONSTRAINT [FK_LBS_Subsheets] FOREIGN KEY([SubsheetID])
REFERENCES [dbo].[SubSheets] ([SubID])
GO
ALTER TABLE [dbo].[LayoutBodySlots] CHECK CONSTRAINT [FK_LBS_Subsheets]
GO
ALTER TABLE [dbo].[LayoutRegions]  WITH CHECK ADD  CONSTRAINT [FK_LayoutRegions_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[LayoutRegions] CHECK CONSTRAINT [FK_LayoutRegions_AccountID]
GO
ALTER TABLE [dbo].[LayoutRegions]  WITH CHECK ADD  CONSTRAINT [FK_LayoutRegions_Layouts] FOREIGN KEY([LayoutID])
REFERENCES [dbo].[DatasheetLayouts] ([LayoutID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[LayoutRegions] CHECK CONSTRAINT [FK_LayoutRegions_Layouts]
GO
ALTER TABLE [dbo].[LayoutRegions]  WITH CHECK ADD  CONSTRAINT [FK_Regions_Layouts] FOREIGN KEY([LayoutID])
REFERENCES [dbo].[DatasheetLayouts] ([LayoutID])
GO
ALTER TABLE [dbo].[LayoutRegions] CHECK CONSTRAINT [FK_Regions_Layouts]
GO
ALTER TABLE [dbo].[LayoutSubsheetSlots]  WITH CHECK ADD  CONSTRAINT [FK_LayoutSubsheetSlots_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[LayoutSubsheetSlots] CHECK CONSTRAINT [FK_LayoutSubsheetSlots_AccountID]
GO
ALTER TABLE [dbo].[LayoutSubsheetSlots]  WITH CHECK ADD  CONSTRAINT [FK_LSS_DatasheetLayouts] FOREIGN KEY([LayoutID])
REFERENCES [dbo].[DatasheetLayouts] ([LayoutID])
GO
ALTER TABLE [dbo].[LayoutSubsheetSlots] CHECK CONSTRAINT [FK_LSS_DatasheetLayouts]
GO
ALTER TABLE [dbo].[LayoutSubsheetSlots]  WITH CHECK ADD  CONSTRAINT [FK_LSS_InformationTemplates] FOREIGN KEY([InfoTemplateID])
REFERENCES [dbo].[InformationTemplates] ([InfoTemplateID])
GO
ALTER TABLE [dbo].[LayoutSubsheetSlots] CHECK CONSTRAINT [FK_LSS_InformationTemplates]
GO
ALTER TABLE [dbo].[LayoutSubsheetSlots]  WITH CHECK ADD  CONSTRAINT [FK_LSS_InfoTemplates] FOREIGN KEY([InfoTemplateID])
REFERENCES [dbo].[InformationTemplates] ([InfoTemplateID])
GO
ALTER TABLE [dbo].[LayoutSubsheetSlots] CHECK CONSTRAINT [FK_LSS_InfoTemplates]
GO
ALTER TABLE [dbo].[LayoutSubsheetSlots]  WITH CHECK ADD  CONSTRAINT [FK_LSS_Layouts] FOREIGN KEY([LayoutID])
REFERENCES [dbo].[DatasheetLayouts] ([LayoutID])
GO
ALTER TABLE [dbo].[LayoutSubsheetSlots] CHECK CONSTRAINT [FK_LSS_Layouts]
GO
ALTER TABLE [dbo].[LayoutSubsheetSlots]  WITH CHECK ADD  CONSTRAINT [FK_LSS_Subsheets] FOREIGN KEY([SubsheetID])
REFERENCES [dbo].[SubSheets] ([SubID])
GO
ALTER TABLE [dbo].[LayoutSubsheetSlots] CHECK CONSTRAINT [FK_LSS_Subsheets]
GO
ALTER TABLE [dbo].[LoopInstruments]  WITH CHECK ADD  CONSTRAINT [FK_LoopInstruments_Asset] FOREIGN KEY([AssetID])
REFERENCES [dbo].[Assets] ([AssetID])
GO
ALTER TABLE [dbo].[LoopInstruments] CHECK CONSTRAINT [FK_LoopInstruments_Asset]
GO
ALTER TABLE [dbo].[LoopInstruments]  WITH CHECK ADD  CONSTRAINT [FK_LoopInstruments_Loop] FOREIGN KEY([LoopID])
REFERENCES [dbo].[InstrumentLoops] ([LoopID])
GO
ALTER TABLE [dbo].[LoopInstruments] CHECK CONSTRAINT [FK_LoopInstruments_Loop]
GO
ALTER TABLE [dbo].[LoopInstruments]  WITH CHECK ADD  CONSTRAINT [FK_LoopInstruments_Sheet] FOREIGN KEY([SheetID])
REFERENCES [dbo].[Sheets] ([SheetID])
GO
ALTER TABLE [dbo].[LoopInstruments] CHECK CONSTRAINT [FK_LoopInstruments_Sheet]
GO
ALTER TABLE [dbo].[Manufacturers]  WITH CHECK ADD  CONSTRAINT [FK_Manufacturers_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Manufacturers] CHECK CONSTRAINT [FK_Manufacturers_AccountID]
GO
ALTER TABLE [dbo].[MirrorTemplates]  WITH CHECK ADD  CONSTRAINT [FK_MirrorTemplates_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[MirrorTemplates] CHECK CONSTRAINT [FK_MirrorTemplates_AccountID]
GO
ALTER TABLE [dbo].[NotificationRecipients]  WITH CHECK ADD  CONSTRAINT [FK_NotificationRecipients_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[NotificationRecipients] CHECK CONSTRAINT [FK_NotificationRecipients_AccountID]
GO
ALTER TABLE [dbo].[Notifications]  WITH CHECK ADD  CONSTRAINT [FK_Notifications_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Notifications] CHECK CONSTRAINT [FK_Notifications_AccountID]
GO
ALTER TABLE [dbo].[Parties]  WITH CHECK ADD  CONSTRAINT [FK_Parties_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Parties] CHECK CONSTRAINT [FK_Parties_AccountID]
GO
ALTER TABLE [dbo].[PlatformAdmins]  WITH NOCHECK ADD  CONSTRAINT [FK_PlatformAdmins_CreatedByUser] FOREIGN KEY([CreatedByUserID])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[PlatformAdmins] CHECK CONSTRAINT [FK_PlatformAdmins_CreatedByUser]
GO
ALTER TABLE [dbo].[PlatformAdmins]  WITH NOCHECK ADD  CONSTRAINT [FK_PlatformAdmins_RevokedByUser] FOREIGN KEY([RevokedByUserID])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[PlatformAdmins] CHECK CONSTRAINT [FK_PlatformAdmins_RevokedByUser]
GO
ALTER TABLE [dbo].[PlatformAdmins]  WITH NOCHECK ADD  CONSTRAINT [FK_PlatformAdmins_User] FOREIGN KEY([UserID])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[PlatformAdmins] CHECK CONSTRAINT [FK_PlatformAdmins_User]
GO
ALTER TABLE [dbo].[Projects]  WITH CHECK ADD  CONSTRAINT [FK_Projects_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Projects] CHECK CONSTRAINT [FK_Projects_AccountID]
GO
ALTER TABLE [dbo].[Projects]  WITH CHECK ADD  CONSTRAINT [FK_Projects_Clients] FOREIGN KEY([ClientID])
REFERENCES [dbo].[Clients] ([ClientID])
GO
ALTER TABLE [dbo].[Projects] CHECK CONSTRAINT [FK_Projects_Clients]
GO
ALTER TABLE [dbo].[Projects]  WITH NOCHECK ADD  CONSTRAINT [FK_Projects_Manager] FOREIGN KEY([ManagerID])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[Projects] CHECK CONSTRAINT [FK_Projects_Manager]
GO
ALTER TABLE [dbo].[RatingsBlocks]  WITH NOCHECK ADD  CONSTRAINT [FK_RatingsBlocks_LockedBy] FOREIGN KEY([LockedBy])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[RatingsBlocks] CHECK CONSTRAINT [FK_RatingsBlocks_LockedBy]
GO
ALTER TABLE [dbo].[RatingsBlocks]  WITH CHECK ADD  CONSTRAINT [FK_RatingsBlocks_Sheets] FOREIGN KEY([SheetID])
REFERENCES [dbo].[Sheets] ([SheetID])
GO
ALTER TABLE [dbo].[RatingsBlocks] CHECK CONSTRAINT [FK_RatingsBlocks_Sheets]
GO
ALTER TABLE [dbo].[RatingsBlocks]  WITH CHECK ADD  CONSTRAINT [FK_RatingsBlocks_SourceValueSet] FOREIGN KEY([SourceValueSetID])
REFERENCES [dbo].[InformationValueSets] ([ValueSetID])
GO
ALTER TABLE [dbo].[RatingsBlocks] CHECK CONSTRAINT [FK_RatingsBlocks_SourceValueSet]
GO
ALTER TABLE [dbo].[RatingsEntries]  WITH CHECK ADD  CONSTRAINT [FK_RatingsEntries_Block] FOREIGN KEY([RatingsBlockID])
REFERENCES [dbo].[RatingsBlocks] ([RatingsBlockID])
GO
ALTER TABLE [dbo].[RatingsEntries] CHECK CONSTRAINT [FK_RatingsEntries_Block]
GO
ALTER TABLE [dbo].[ScheduleColumns]  WITH CHECK ADD  CONSTRAINT [FK_ScheduleColumns_Accounts] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[ScheduleColumns] CHECK CONSTRAINT [FK_ScheduleColumns_Accounts]
GO
ALTER TABLE [dbo].[ScheduleColumns]  WITH CHECK ADD  CONSTRAINT [FK_ScheduleColumns_Schedules] FOREIGN KEY([ScheduleID])
REFERENCES [dbo].[Schedules] ([ScheduleID])
GO
ALTER TABLE [dbo].[ScheduleColumns] CHECK CONSTRAINT [FK_ScheduleColumns_Schedules]
GO
ALTER TABLE [dbo].[ScheduleEntries]  WITH CHECK ADD  CONSTRAINT [FK_ScheduleEntries_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[ScheduleEntries] CHECK CONSTRAINT [FK_ScheduleEntries_AccountID]
GO
ALTER TABLE [dbo].[ScheduleEntries]  WITH CHECK ADD  CONSTRAINT [FK_ScheduleEntries_Asset] FOREIGN KEY([AssetID])
REFERENCES [dbo].[Assets] ([AssetID])
GO
ALTER TABLE [dbo].[ScheduleEntries] CHECK CONSTRAINT [FK_ScheduleEntries_Asset]
GO
ALTER TABLE [dbo].[ScheduleEntries]  WITH NOCHECK ADD  CONSTRAINT [FK_ScheduleEntries_CreatedBy] FOREIGN KEY([CreatedBy])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[ScheduleEntries] CHECK CONSTRAINT [FK_ScheduleEntries_CreatedBy]
GO
ALTER TABLE [dbo].[ScheduleEntries]  WITH CHECK ADD  CONSTRAINT [FK_ScheduleEntries_Schedule] FOREIGN KEY([ScheduleID])
REFERENCES [dbo].[Schedules] ([ScheduleID])
GO
ALTER TABLE [dbo].[ScheduleEntries] CHECK CONSTRAINT [FK_ScheduleEntries_Schedule]
GO
ALTER TABLE [dbo].[ScheduleEntries]  WITH CHECK ADD  CONSTRAINT [FK_ScheduleEntries_Sheet] FOREIGN KEY([SheetID])
REFERENCES [dbo].[Sheets] ([SheetID])
GO
ALTER TABLE [dbo].[ScheduleEntries] CHECK CONSTRAINT [FK_ScheduleEntries_Sheet]
GO
ALTER TABLE [dbo].[ScheduleEntryValues]  WITH CHECK ADD  CONSTRAINT [FK_ScheduleEntryValues_Accounts] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[ScheduleEntryValues] CHECK CONSTRAINT [FK_ScheduleEntryValues_Accounts]
GO
ALTER TABLE [dbo].[ScheduleEntryValues]  WITH CHECK ADD  CONSTRAINT [FK_ScheduleEntryValues_Columns] FOREIGN KEY([ScheduleColumnID])
REFERENCES [dbo].[ScheduleColumns] ([ScheduleColumnID])
GO
ALTER TABLE [dbo].[ScheduleEntryValues] CHECK CONSTRAINT [FK_ScheduleEntryValues_Columns]
GO
ALTER TABLE [dbo].[ScheduleEntryValues]  WITH CHECK ADD  CONSTRAINT [FK_ScheduleEntryValues_Entries] FOREIGN KEY([ScheduleEntryID])
REFERENCES [dbo].[ScheduleEntries] ([ScheduleEntryID])
GO
ALTER TABLE [dbo].[ScheduleEntryValues] CHECK CONSTRAINT [FK_ScheduleEntryValues_Entries]
GO
ALTER TABLE [dbo].[Schedules]  WITH CHECK ADD  CONSTRAINT [FK_Schedules_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Schedules] CHECK CONSTRAINT [FK_Schedules_AccountID]
GO
ALTER TABLE [dbo].[Schedules]  WITH CHECK ADD  CONSTRAINT [FK_Schedules_Client] FOREIGN KEY([ClientID])
REFERENCES [dbo].[Clients] ([ClientID])
GO
ALTER TABLE [dbo].[Schedules] CHECK CONSTRAINT [FK_Schedules_Client]
GO
ALTER TABLE [dbo].[Schedules]  WITH NOCHECK ADD  CONSTRAINT [FK_Schedules_CreatedBy] FOREIGN KEY([CreatedBy])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[Schedules] CHECK CONSTRAINT [FK_Schedules_CreatedBy]
GO
ALTER TABLE [dbo].[Schedules]  WITH CHECK ADD  CONSTRAINT [FK_Schedules_Discipline] FOREIGN KEY([DisciplineID])
REFERENCES [dbo].[Disciplines] ([DisciplineID])
GO
ALTER TABLE [dbo].[Schedules] CHECK CONSTRAINT [FK_Schedules_Discipline]
GO
ALTER TABLE [dbo].[Schedules]  WITH CHECK ADD  CONSTRAINT [FK_Schedules_Project] FOREIGN KEY([ProjectID])
REFERENCES [dbo].[Projects] ([ProjectID])
GO
ALTER TABLE [dbo].[Schedules] CHECK CONSTRAINT [FK_Schedules_Project]
GO
ALTER TABLE [dbo].[Schedules]  WITH CHECK ADD  CONSTRAINT [FK_Schedules_Subtype] FOREIGN KEY([SubtypeID])
REFERENCES [dbo].[DatasheetSubtypes] ([SubtypeID])
GO
ALTER TABLE [dbo].[Schedules] CHECK CONSTRAINT [FK_Schedules_Subtype]
GO
ALTER TABLE [dbo].[Schedules]  WITH NOCHECK ADD  CONSTRAINT [FK_Schedules_UpdatedBy] FOREIGN KEY([UpdatedBy])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[Schedules] CHECK CONSTRAINT [FK_Schedules_UpdatedBy]
GO
ALTER TABLE [dbo].[Sessions]  WITH CHECK ADD  CONSTRAINT [FK_Sessions_Accounts_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Sessions] CHECK CONSTRAINT [FK_Sessions_Accounts_AccountID]
GO
ALTER TABLE [dbo].[SheetAttachmentLinks]  WITH CHECK ADD  CONSTRAINT [FK_SAL_Attachments] FOREIGN KEY([AttachmentID])
REFERENCES [dbo].[Attachments] ([AttachmentID])
GO
ALTER TABLE [dbo].[SheetAttachmentLinks] CHECK CONSTRAINT [FK_SAL_Attachments]
GO
ALTER TABLE [dbo].[SheetAttachmentLinks]  WITH CHECK ADD  CONSTRAINT [FK_SAL_Sheets] FOREIGN KEY([SheetID])
REFERENCES [dbo].[Sheets] ([SheetID])
GO
ALTER TABLE [dbo].[SheetAttachmentLinks] CHECK CONSTRAINT [FK_SAL_Sheets]
GO
ALTER TABLE [dbo].[SheetAttachments]  WITH CHECK ADD  CONSTRAINT [FK_SheetAttachments_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[SheetAttachments] CHECK CONSTRAINT [FK_SheetAttachments_AccountID]
GO
ALTER TABLE [dbo].[SheetAttachments]  WITH CHECK ADD  CONSTRAINT [FK_SheetAttachments_Attachments] FOREIGN KEY([AttachmentID])
REFERENCES [dbo].[Attachments] ([AttachmentID])
GO
ALTER TABLE [dbo].[SheetAttachments] CHECK CONSTRAINT [FK_SheetAttachments_Attachments]
GO
ALTER TABLE [dbo].[SheetAttachments]  WITH CHECK ADD  CONSTRAINT [FK_SheetAttachments_Sheet] FOREIGN KEY([SheetID])
REFERENCES [dbo].[Sheets] ([SheetID])
GO
ALTER TABLE [dbo].[SheetAttachments] CHECK CONSTRAINT [FK_SheetAttachments_Sheet]
GO
ALTER TABLE [dbo].[SheetHeaderKV]  WITH CHECK ADD  CONSTRAINT [FK_SheetHeaderKV_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[SheetHeaderKV] CHECK CONSTRAINT [FK_SheetHeaderKV_AccountID]
GO
ALTER TABLE [dbo].[SheetHeaderKV]  WITH CHECK ADD  CONSTRAINT [FK_SheetHeaderKV_Sheets] FOREIGN KEY([SheetID])
REFERENCES [dbo].[Sheets] ([SheetID])
GO
ALTER TABLE [dbo].[SheetHeaderKV] CHECK CONSTRAINT [FK_SheetHeaderKV_Sheets]
GO
ALTER TABLE [dbo].[SheetNotes]  WITH CHECK ADD  CONSTRAINT [FK_SheetNotes_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[SheetNotes] CHECK CONSTRAINT [FK_SheetNotes_AccountID]
GO
ALTER TABLE [dbo].[SheetNotes]  WITH CHECK ADD  CONSTRAINT [FK_SheetNotes_New_NoteTypes] FOREIGN KEY([NoteTypeID])
REFERENCES [dbo].[NoteTypes] ([NoteTypeID])
GO
ALTER TABLE [dbo].[SheetNotes] CHECK CONSTRAINT [FK_SheetNotes_New_NoteTypes]
GO
ALTER TABLE [dbo].[SheetNotes]  WITH CHECK ADD  CONSTRAINT [FK_SheetNotes_New_Sheets] FOREIGN KEY([SheetID])
REFERENCES [dbo].[Sheets] ([SheetID])
GO
ALTER TABLE [dbo].[SheetNotes] CHECK CONSTRAINT [FK_SheetNotes_New_Sheets]
GO
ALTER TABLE [dbo].[SheetRevisions]  WITH CHECK ADD  CONSTRAINT [FK_SheetRevisions_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[SheetRevisions] CHECK CONSTRAINT [FK_SheetRevisions_AccountID]
GO
ALTER TABLE [dbo].[SheetRevisions]  WITH CHECK ADD  CONSTRAINT [FK_SheetRevisions_SheetID] FOREIGN KEY([SheetID])
REFERENCES [dbo].[Sheets] ([SheetID])
GO
ALTER TABLE [dbo].[SheetRevisions] CHECK CONSTRAINT [FK_SheetRevisions_SheetID]
GO
ALTER TABLE [dbo].[Sheets]  WITH CHECK ADD  CONSTRAINT [FK_Sheets_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Sheets] CHECK CONSTRAINT [FK_Sheets_AccountID]
GO
ALTER TABLE [dbo].[Sheets]  WITH CHECK ADD  CONSTRAINT [FK_Sheets_Accounts_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Sheets] CHECK CONSTRAINT [FK_Sheets_Accounts_AccountID]
GO
ALTER TABLE [dbo].[Sheets]  WITH CHECK ADD  CONSTRAINT [FK_Sheets_Assets] FOREIGN KEY([AssetID])
REFERENCES [dbo].[Assets] ([AssetID])
GO
ALTER TABLE [dbo].[Sheets] CHECK CONSTRAINT [FK_Sheets_Assets]
GO
ALTER TABLE [dbo].[Sheets]  WITH CHECK ADD  CONSTRAINT [FK_Sheets_Disciplines] FOREIGN KEY([DisciplineID])
REFERENCES [dbo].[Disciplines] ([DisciplineID])
GO
ALTER TABLE [dbo].[Sheets] CHECK CONSTRAINT [FK_Sheets_Disciplines]
GO
ALTER TABLE [dbo].[Sheets]  WITH CHECK ADD  CONSTRAINT [FK_Sheets_LifecycleStates] FOREIGN KEY([LifecycleStateID])
REFERENCES [dbo].[LifecycleStates] ([LifecycleStateID])
GO
ALTER TABLE [dbo].[Sheets] CHECK CONSTRAINT [FK_Sheets_LifecycleStates]
GO
ALTER TABLE [dbo].[Sheets]  WITH CHECK ADD  CONSTRAINT [FK_Sheets_Subtypes] FOREIGN KEY([SubtypeID])
REFERENCES [dbo].[DatasheetSubtypes] ([SubtypeID])
GO
ALTER TABLE [dbo].[Sheets] CHECK CONSTRAINT [FK_Sheets_Subtypes]
GO
ALTER TABLE [dbo].[SheetTemplates]  WITH CHECK ADD  CONSTRAINT [FK_SheetTemplates_Disciplines] FOREIGN KEY([DisciplineID])
REFERENCES [dbo].[Disciplines] ([DisciplineID])
GO
ALTER TABLE [dbo].[SheetTemplates] CHECK CONSTRAINT [FK_SheetTemplates_Disciplines]
GO
ALTER TABLE [dbo].[SheetTemplates]  WITH CHECK ADD  CONSTRAINT [FK_SheetTemplates_Subtypes] FOREIGN KEY([SubtypeID])
REFERENCES [dbo].[DatasheetSubtypes] ([SubtypeID])
GO
ALTER TABLE [dbo].[SheetTemplates] CHECK CONSTRAINT [FK_SheetTemplates_Subtypes]
GO
ALTER TABLE [dbo].[SubSheets]  WITH CHECK ADD  CONSTRAINT [FK_SubSheets_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[SubSheets] CHECK CONSTRAINT [FK_SubSheets_AccountID]
GO
ALTER TABLE [dbo].[Suppliers]  WITH CHECK ADD  CONSTRAINT [FK_Suppliers_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Suppliers] CHECK CONSTRAINT [FK_Suppliers_AccountID]
GO
ALTER TABLE [dbo].[SupportImpersonationSessions]  WITH CHECK ADD  CONSTRAINT [FK_SIS_AccountID_Accounts] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[SupportImpersonationSessions] CHECK CONSTRAINT [FK_SIS_AccountID_Accounts]
GO
ALTER TABLE [dbo].[SupportImpersonationSessions]  WITH NOCHECK ADD  CONSTRAINT [FK_SIS_PlatformUserID_Users] FOREIGN KEY([PlatformUserID])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[SupportImpersonationSessions] CHECK CONSTRAINT [FK_SIS_PlatformUserID_Users]
GO
ALTER TABLE [dbo].[TemplateChangeLogs]  WITH CHECK ADD  CONSTRAINT [FK_TemplateChangeLogs_Sheets] FOREIGN KEY([SheetID])
REFERENCES [dbo].[Sheets] ([SheetID])
GO
ALTER TABLE [dbo].[TemplateChangeLogs] CHECK CONSTRAINT [FK_TemplateChangeLogs_Sheets]
GO
ALTER TABLE [dbo].[UserActiveAccount]  WITH CHECK ADD  CONSTRAINT [FK_UserActiveAccount_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[UserActiveAccount] CHECK CONSTRAINT [FK_UserActiveAccount_AccountID]
GO
ALTER TABLE [dbo].[UserActiveAccount]  WITH NOCHECK ADD  CONSTRAINT [FK_UserActiveAccount_UserID] FOREIGN KEY([UserID])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[UserActiveAccount] CHECK CONSTRAINT [FK_UserActiveAccount_UserID]
GO
ALTER TABLE [dbo].[ValueSetFieldVariances]  WITH CHECK ADD  CONSTRAINT [FK_ValueSetFieldVariances_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[ValueSetFieldVariances] CHECK CONSTRAINT [FK_ValueSetFieldVariances_AccountID]
GO
ALTER TABLE [dbo].[ValueSetFieldVariances]  WITH CHECK ADD  CONSTRAINT [FK_ValueSetFieldVariances_InfoTemplateID] FOREIGN KEY([InfoTemplateID])
REFERENCES [dbo].[InformationTemplates] ([InfoTemplateID])
GO
ALTER TABLE [dbo].[ValueSetFieldVariances] CHECK CONSTRAINT [FK_ValueSetFieldVariances_InfoTemplateID]
GO
ALTER TABLE [dbo].[ValueSetFieldVariances]  WITH NOCHECK ADD  CONSTRAINT [FK_ValueSetFieldVariances_ReviewedBy] FOREIGN KEY([ReviewedBy])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[ValueSetFieldVariances] CHECK CONSTRAINT [FK_ValueSetFieldVariances_ReviewedBy]
GO
ALTER TABLE [dbo].[ValueSetFieldVariances]  WITH CHECK ADD  CONSTRAINT [FK_ValueSetFieldVariances_ValueSetID] FOREIGN KEY([ValueSetID])
REFERENCES [dbo].[InformationValueSets] ([ValueSetID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[ValueSetFieldVariances] CHECK CONSTRAINT [FK_ValueSetFieldVariances_ValueSetID]
GO
ALTER TABLE [dbo].[VerificationRecordAttachments]  WITH CHECK ADD  CONSTRAINT [FK_VerificationRecordAttachments_AttachmentID] FOREIGN KEY([AttachmentID])
REFERENCES [dbo].[Attachments] ([AttachmentID])
GO
ALTER TABLE [dbo].[VerificationRecordAttachments] CHECK CONSTRAINT [FK_VerificationRecordAttachments_AttachmentID]
GO
ALTER TABLE [dbo].[VerificationRecordAttachments]  WITH CHECK ADD  CONSTRAINT [FK_VerificationRecordAttachments_VerificationRecordID] FOREIGN KEY([VerificationRecordID])
REFERENCES [dbo].[VerificationRecords] ([VerificationRecordID])
GO
ALTER TABLE [dbo].[VerificationRecordAttachments] CHECK CONSTRAINT [FK_VerificationRecordAttachments_VerificationRecordID]
GO
ALTER TABLE [dbo].[VerificationRecordLinks]  WITH CHECK ADD  CONSTRAINT [FK_VerificationRecordLinks_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[VerificationRecordLinks] CHECK CONSTRAINT [FK_VerificationRecordLinks_AccountID]
GO
ALTER TABLE [dbo].[VerificationRecordLinks]  WITH CHECK ADD  CONSTRAINT [FK_VerificationRecordLinks_SheetID] FOREIGN KEY([SheetID])
REFERENCES [dbo].[Sheets] ([SheetID])
GO
ALTER TABLE [dbo].[VerificationRecordLinks] CHECK CONSTRAINT [FK_VerificationRecordLinks_SheetID]
GO
ALTER TABLE [dbo].[VerificationRecordLinks]  WITH CHECK ADD  CONSTRAINT [FK_VerificationRecordLinks_VerificationRecordID] FOREIGN KEY([VerificationRecordID])
REFERENCES [dbo].[VerificationRecords] ([VerificationRecordID])
GO
ALTER TABLE [dbo].[VerificationRecordLinks] CHECK CONSTRAINT [FK_VerificationRecordLinks_VerificationRecordID]
GO
ALTER TABLE [dbo].[VerificationRecords]  WITH CHECK ADD  CONSTRAINT [FK_VerificationRecords_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[VerificationRecords] CHECK CONSTRAINT [FK_VerificationRecords_AccountID]
GO
ALTER TABLE [dbo].[VerificationRecords]  WITH NOCHECK ADD  CONSTRAINT [FK_VerificationRecords_CreatedBy] FOREIGN KEY([CreatedBy])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[VerificationRecords] CHECK CONSTRAINT [FK_VerificationRecords_CreatedBy]
GO
ALTER TABLE [dbo].[VerificationRecords]  WITH CHECK ADD  CONSTRAINT [FK_VerificationRecords_Issuer] FOREIGN KEY([IssuerPartyID])
REFERENCES [dbo].[Parties] ([PartyID])
GO
ALTER TABLE [dbo].[VerificationRecords] CHECK CONSTRAINT [FK_VerificationRecords_Issuer]
GO
ALTER TABLE [dbo].[VerificationRecords]  WITH CHECK ADD  CONSTRAINT [FK_VerificationRecords_Type] FOREIGN KEY([VerificationTypeID])
REFERENCES [dbo].[VerificationRecordTypes] ([VerificationTypeID])
GO
ALTER TABLE [dbo].[VerificationRecords] CHECK CONSTRAINT [FK_VerificationRecords_Type]
GO
ALTER TABLE [dbo].[VerificationRecords]  WITH NOCHECK ADD  CONSTRAINT [FK_VerificationRecords_UpdatedBy] FOREIGN KEY([UpdatedBy])
REFERENCES [dbo].[Users] ([UserID])
GO
ALTER TABLE [dbo].[VerificationRecords] CHECK CONSTRAINT [FK_VerificationRecords_UpdatedBy]
GO
ALTER TABLE [dbo].[VerificationRecordTypes]  WITH CHECK ADD  CONSTRAINT [FK_VerificationRecordTypes_Disciplines] FOREIGN KEY([DisciplineID])
REFERENCES [dbo].[Disciplines] ([DisciplineID])
GO
ALTER TABLE [dbo].[VerificationRecordTypes] CHECK CONSTRAINT [FK_VerificationRecordTypes_Disciplines]
GO
ALTER TABLE [dbo].[Warehouses]  WITH CHECK ADD  CONSTRAINT [FK_Warehouses_AccountID] FOREIGN KEY([AccountID])
REFERENCES [dbo].[Accounts] ([AccountID])
GO
ALTER TABLE [dbo].[Warehouses] CHECK CONSTRAINT [FK_Warehouses_AccountID]
GO
ALTER TABLE [dbo].[AccountInvites]  WITH CHECK ADD  CONSTRAINT [CK_AccountInvites_Status] CHECK  (([Status]=N'Expired' OR [Status]=N'Declined' OR [Status]=N'Revoked' OR [Status]=N'Accepted' OR [Status]=N'Pending'))
GO
ALTER TABLE [dbo].[AccountInvites] CHECK CONSTRAINT [CK_AccountInvites_Status]
GO
ALTER TABLE [dbo].[LoopInstruments]  WITH CHECK ADD  CONSTRAINT [CK_LoopInstruments_Target] CHECK  (([AssetID] IS NOT NULL AND [SheetID] IS NULL OR [AssetID] IS NULL AND [SheetID] IS NOT NULL))
GO
ALTER TABLE [dbo].[LoopInstruments] CHECK CONSTRAINT [CK_LoopInstruments_Target]
GO
ALTER TABLE [dbo].[Parties]  WITH CHECK ADD  CONSTRAINT [CK_Parties_PartyType] CHECK  (([PartyType]='INTERNAL' OR [PartyType]='THIRD_PARTY' OR [PartyType]='MANUFACTURER' OR [PartyType]='VENDOR' OR [PartyType]='CLIENT'))
GO
ALTER TABLE [dbo].[Parties] CHECK CONSTRAINT [CK_Parties_PartyType]
GO
ALTER TABLE [dbo].[PlatformAdmins]  WITH CHECK ADD  CONSTRAINT [CK_PlatformAdmins_RevokeConsistency] CHECK  (([IsActive]=(1) AND [RevokedAt] IS NULL AND [RevokedByUserID] IS NULL OR [IsActive]=(0) AND [RevokedAt] IS NOT NULL))
GO
ALTER TABLE [dbo].[PlatformAdmins] CHECK CONSTRAINT [CK_PlatformAdmins_RevokeConsistency]
GO
ALTER TABLE [dbo].[ScheduleEntries]  WITH CHECK ADD  CONSTRAINT [CK_ScheduleEntries_Target] CHECK  (([AssetID] IS NOT NULL AND [SheetID] IS NULL OR [AssetID] IS NULL AND [SheetID] IS NOT NULL))
GO
ALTER TABLE [dbo].[ScheduleEntries] CHECK CONSTRAINT [CK_ScheduleEntries_Target]
GO
ALTER TABLE [dbo].[Schedules]  WITH CHECK ADD  CONSTRAINT [CK_Schedules_Scope] CHECK  (([Scope]='System' OR [Scope]='Facility' OR [Scope]='Project'))
GO
ALTER TABLE [dbo].[Schedules] CHECK CONSTRAINT [CK_Schedules_Scope]
GO
ALTER TABLE [dbo].[ValueSetFieldVariances]  WITH CHECK ADD  CONSTRAINT [CK_ValueSetFieldVariances_Status] CHECK  (([VarianceStatus]='DeviatesRejected' OR [VarianceStatus]='DeviatesAccepted'))
GO
ALTER TABLE [dbo].[ValueSetFieldVariances] CHECK CONSTRAINT [CK_ValueSetFieldVariances_Status]
GO
ALTER TABLE [dbo].[VerificationRecords]  WITH CHECK ADD  CONSTRAINT [CK_VerificationRecords_Result] CHECK  (([Result]='CONDITIONAL' OR [Result]='FAIL' OR [Result]='PASS'))
GO
ALTER TABLE [dbo].[VerificationRecords] CHECK CONSTRAINT [CK_VerificationRecords_Result]
GO
/****** Object:  StoredProcedure [dbo].[sp_drop_default_if_exists]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROC [dbo].[sp_drop_default_if_exists]
  @table SYSNAME, @column SYSNAME
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @dc SYSNAME;
  SELECT @dc = dc.name
  FROM sys.default_constraints dc
  JOIN sys.columns c ON c.default_object_id = dc.object_id
  JOIN sys.objects o ON o.object_id = c.object_id
  WHERE o.name = PARSENAME(@table,1) AND c.name = @column
        AND (SCHEMA_NAME(o.schema_id) = ISNULL(PARSENAME(@table,2), SCHEMA_NAME(o.schema_id)));
  IF @dc IS NOT NULL
  BEGIN
    DECLARE @sql NVARCHAR(MAX) = N'ALTER TABLE ' + @table + N' DROP CONSTRAINT ' + QUOTENAME(@dc) + N';';
    EXEC sp_executesql @sql;
  END
END
GO
/****** Object:  Trigger [dbo].[TR_Assets_UpdatedAt]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE TRIGGER [dbo].[TR_Assets_UpdatedAt]
ON [dbo].[Assets]
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON
  UPDATE a
  SET UpdatedAt = SYSUTCDATETIME()
  FROM dbo.Assets a
  INNER JOIN inserted i ON i.AssetID = a.AssetID
END
GO
ALTER TABLE [dbo].[Assets] ENABLE TRIGGER [TR_Assets_UpdatedAt]
GO
/****** Object:  Trigger [dbo].[TR_DatasheetSubtypes_UpdatedAt]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE TRIGGER [dbo].[TR_DatasheetSubtypes_UpdatedAt]
ON [dbo].[DatasheetSubtypes]
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON
  UPDATE s
  SET UpdatedAt = SYSUTCDATETIME()
  FROM dbo.DatasheetSubtypes s
  INNER JOIN inserted i ON i.SubtypeID = s.SubtypeID
END
GO
ALTER TABLE [dbo].[DatasheetSubtypes] ENABLE TRIGGER [TR_DatasheetSubtypes_UpdatedAt]
GO
/****** Object:  Trigger [dbo].[TR_Disciplines_UpdatedAt]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE TRIGGER [dbo].[TR_Disciplines_UpdatedAt]
ON [dbo].[Disciplines]
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON
  UPDATE d
  SET UpdatedAt = SYSUTCDATETIME()
  FROM dbo.Disciplines d
  INNER JOIN inserted i ON i.DisciplineID = d.DisciplineID
END
GO
ALTER TABLE [dbo].[Disciplines] ENABLE TRIGGER [TR_Disciplines_UpdatedAt]
GO
/****** Object:  Trigger [dbo].[TR_InformationValueSets_UpdatedAt]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE TRIGGER [dbo].[TR_InformationValueSets_UpdatedAt]
ON [dbo].[InformationValueSets]
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON
  UPDATE s
  SET UpdatedAt = SYSUTCDATETIME()
  FROM dbo.InformationValueSets s
  INNER JOIN inserted i ON i.ValueSetID = s.ValueSetID
END
GO
ALTER TABLE [dbo].[InformationValueSets] ENABLE TRIGGER [TR_InformationValueSets_UpdatedAt]
GO
/****** Object:  Trigger [dbo].[TR_LifecycleStates_UpdatedAt]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE TRIGGER [dbo].[TR_LifecycleStates_UpdatedAt]
ON [dbo].[LifecycleStates]
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON
  UPDATE x
  SET UpdatedAt = SYSUTCDATETIME()
  FROM dbo.LifecycleStates x
  INNER JOIN inserted i ON i.LifecycleStateID = x.LifecycleStateID
END
GO
ALTER TABLE [dbo].[LifecycleStates] ENABLE TRIGGER [TR_LifecycleStates_UpdatedAt]
GO
/****** Object:  Trigger [dbo].[TR_Parties_UpdatedAt]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE TRIGGER [dbo].[TR_Parties_UpdatedAt]
ON [dbo].[Parties]
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON
  UPDATE p
  SET UpdatedAt = SYSUTCDATETIME()
  FROM dbo.Parties p
  INNER JOIN inserted i ON i.PartyID = p.PartyID
END
GO
ALTER TABLE [dbo].[Parties] ENABLE TRIGGER [TR_Parties_UpdatedAt]
GO
/****** Object:  Trigger [dbo].[TR_ScheduleColumns_AccountID_Enforce]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   TRIGGER [dbo].[TR_ScheduleColumns_AccountID_Enforce]
ON [dbo].[ScheduleColumns]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON

  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN dbo.Schedules s ON s.ScheduleID = i.ScheduleID
    WHERE i.AccountID <> s.AccountID
  )
  BEGIN
    THROW 51001, 'ScheduleColumns.AccountID must match parent Schedules.AccountID.', 1
  END
END
GO
ALTER TABLE [dbo].[ScheduleColumns] ENABLE TRIGGER [TR_ScheduleColumns_AccountID_Enforce]
GO
/****** Object:  Trigger [dbo].[TR_ScheduleEntries_AccountID_Enforce]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   TRIGGER [dbo].[TR_ScheduleEntries_AccountID_Enforce]
ON [dbo].[ScheduleEntries]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON

  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN dbo.Schedules s ON s.ScheduleID = i.ScheduleID
    WHERE i.AccountID <> s.AccountID
  )
  BEGIN
    THROW 51000, 'ScheduleEntries.AccountID must match parent Schedules.AccountID.', 1
  END
END
GO
ALTER TABLE [dbo].[ScheduleEntries] ENABLE TRIGGER [TR_ScheduleEntries_AccountID_Enforce]
GO
/****** Object:  Trigger [dbo].[TR_ScheduleEntries_SheetAccount_Enforce]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   TRIGGER [dbo].[TR_ScheduleEntries_SheetAccount_Enforce]
ON [dbo].[ScheduleEntries]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON

  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN dbo.Sheets sh ON sh.SheetID = i.SheetID
    WHERE i.SheetID IS NOT NULL
      AND i.AccountID <> sh.AccountID
  )
  BEGIN
    THROW 51003, 'ScheduleEntries.SheetID must reference a Sheet in the same AccountID.', 1
  END
END
GO
ALTER TABLE [dbo].[ScheduleEntries] ENABLE TRIGGER [TR_ScheduleEntries_SheetAccount_Enforce]
GO
/****** Object:  Trigger [dbo].[TR_ScheduleEntryValues_AccountID_Enforce]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   TRIGGER [dbo].[TR_ScheduleEntryValues_AccountID_Enforce]
ON [dbo].[ScheduleEntryValues]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON

  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN dbo.ScheduleEntries se ON se.ScheduleEntryID = i.ScheduleEntryID
    JOIN dbo.ScheduleColumns sc ON sc.ScheduleColumnID = i.ScheduleColumnID
    WHERE i.AccountID <> se.AccountID
       OR i.AccountID <> sc.AccountID
  )
  BEGIN
    THROW 51002, 'ScheduleEntryValues.AccountID must match parent entry and column AccountID.', 1
  END
END
GO
ALTER TABLE [dbo].[ScheduleEntryValues] ENABLE TRIGGER [TR_ScheduleEntryValues_AccountID_Enforce]
GO
/****** Object:  Trigger [dbo].[TR_ValueContexts_UpdatedAt]    Script Date: 2/12/2026 2:20:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE TRIGGER [dbo].[TR_ValueContexts_UpdatedAt]
ON [dbo].[ValueContexts]
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON
  UPDATE c
  SET UpdatedAt = SYSUTCDATETIME()
  FROM dbo.ValueContexts c
  INNER JOIN inserted i ON i.ContextID = c.ContextID
END
GO
ALTER TABLE [dbo].[ValueContexts] ENABLE TRIGGER [TR_ValueContexts_UpdatedAt]
GO
/****** Object:  Trigger [dbo].[tr_VerificationRecordLinks_AccountID_Consistency]    Script Date: 2/12/2026 2:20:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

    CREATE TRIGGER [dbo].[tr_VerificationRecordLinks_AccountID_Consistency]
    ON [dbo].[VerificationRecordLinks]
    AFTER INSERT, UPDATE
    AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (
            SELECT 1
            FROM inserted i
            INNER JOIN dbo.VerificationRecords vr ON vr.VerificationRecordID = i.VerificationRecordID
            WHERE vr.AccountID <> i.AccountID
        )
        BEGIN
            RAISERROR(N'VerificationRecordLinks.AccountID must match VerificationRecords.AccountID for the linked record.', 16, 1);
            ROLLBACK TRANSACTION;
            RETURN;
        END
    END
    
GO
ALTER TABLE [dbo].[VerificationRecordLinks] ENABLE TRIGGER [tr_VerificationRecordLinks_AccountID_Consistency]
GO
