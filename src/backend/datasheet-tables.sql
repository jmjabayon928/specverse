CREATE TABLE Actions
(
	ActionID INT IDENTITY(1,1) PRIMARY KEY,
	ActionName VARCHAR(75) NOT NULL,
	ActionDesc VARCHAR(150) NOT NULL
);

CREATE TABLE AIPredictions (
    PredictionID INT IDENTITY(1,1) PRIMARY KEY,
    SheetID INT NOT NULL,
    PredictionType VARCHAR(50), -- e.g., 'Failure Risk'
    PredictionValue VARCHAR(255),
    PredictionDate DATETIME DEFAULT GETDATE(),
    ModelVersion VARCHAR(50),
    CONSTRAINT FK_AI_Sheet FOREIGN KEY (SheetID) REFERENCES Sheets(SheetID)
);


CREATE TABLE Areas
(
	AreaID	INT IDENTITY(1,1) PRIMARY KEY,
	AreaCode VARCHAR(15) NOT NULL UNIQUE,
	AreaName VARCHAR(255) NOT NULL UNIQUE,
	HeadID INT NOT NULL,
	CONSTRAINT FK_Areas_Employees FOREIGN KEY (HeadID) REFERENCES Employees(EmployeeID)
);

CREATE TABLE Attachments
(
	AttachmentID INT IDENTITY(1,1) PRIMARY KEY,
	AttachmentName VARCHAR(255) NOT NULL,
	AttachmentDate DATE NOT NULL,
	SheetID INT NOT NULL,
	AttachedByID INT NOT NULL,
	CONSTRAINT FK_Attachments_Sheets FOREIGN KEY (SheetID) REFERENCES Sheets(SheetID),
	CONSTRAINT FK_Attachments_Users FOREIGN KEY (AttachedByID) REFERENCES Users(UserID)
);

CREATE TABLE Categories
(
	CategoryID INT IDENTITY(1,1) PRIMARY KEY,
	CategoryCode VARCHAR(20) NOT NULL,
	CategoryName VARCHAR(150) NOT NULL,
);

CREATE TABLE ChangeHistory (
    ChangeID INT IDENTITY(1,1) PRIMARY KEY,
    TableName VARCHAR(50) NOT NULL,
    RecordID INT NOT NULL,
    FieldName VARCHAR(100) NOT NULL,
    OldValue VARCHAR(255),
    NewValue VARCHAR(255),
    ChangedBy INT,
    ChangedAt DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Change_Users FOREIGN KEY (ChangedBy) REFERENCES Users(UserID)
);


-- conversions from SI to USC
CREATE TABLE Conversions
(
	ConvID INT IDENTITY(1,1) PRIMARY KEY,
	SiUomCode VARCHAR(15) NOT NULL,
	SiUomName VARCHAR(60) NOT NULL,
	UscUomCode VARCHAR(15) NOT NULL,
	UscUomName VARCHAR(60) NOT NULL,
);

CREATE TABLE Clients
(
	ClientID INT IDENTITY(1,1) PRIMARY KEY,
	ClientCode VARCHAR(20) NOT NULL,
	ClientName VARCHAR(150) NOT NULL,
	ClientEmail VARCHAR(150) NOT NULL,
	ClientPhone VARCHAR(150) NOT NULL,
	ClientAddress VARCHAR(150) NOT NULL,
	ContactPerson VARCHAR(150) NOT NULL,
	ClientLogo VARCHAR(150) NOT NULL
);

CREATE TABLE Departments
(
	DeptID	INT IDENTITY(1,1) PRIMARY KEY,
	DeptCode VARCHAR(20) NOT NULL,
	DeptName VARCHAR(150) NOT NULL,
	HeadID INT NOT NULL,
	CONSTRAINT FK_Departments_Employees FOREIGN KEY (HeadID) REFERENCES Employees(EmployeeID)
);

CREATE TABLE Employees
(
	EmployeeID	INT IDENTITY(1,1) PRIMARY KEY,
	FirstName VARCHAR(75) NOT NULL,
	LastName VARCHAR(75) NOT NULL,
	EmpEmail NVARCHAR(100) NOT NULL,
	PasswordHash VARBINARY(MAX) NOT NULL,
    PasswordSalt UNIQUEIDENTIFIER NOT NULL,
	DeptID INT NOT NULL,
	CONSTRAINT FK_Employees_Departments FOREIGN KEY (DeptID) REFERENCES Departments(DeptID)
);

-- information holds the values for each information inside a subsheet
CREATE TABLE Information
(
	InfoID	INT IDENTITY(1,1) PRIMARY KEY,
	Label VARCHAR(150) NOT NULL, -- for english
	LabelFr VARCHAR(150) NOT NULL, -- for french
	InfoType VARCHAR(30) NOT NULL,
	InfoValue1 VARCHAR(255) NOT NULL, -- for SI value
	InfoValue2 VARCHAR(255) NOT NULL, -- for USC value
	UOM1 VARCHAR(20) NULL, -- Unit measurement for SI
	UOM2 VARCHAR(20) NULL, -- Unit measurement for USC
	SubID INT NOT NULL,
	CONSTRAINT FK_Information_SubSheets FOREIGN KEY (SubID) REFERENCES SubSheets(SubID),
);

CREATE TABLE Inventory (
    InventoryID INT IDENTITY(1,1) PRIMARY KEY,
    SheetID INT NOT NULL,
    WarehouseID INT NOT NULL,
    Quantity INT NOT NULL,
    LastUpdated DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Inventory_Sheet FOREIGN KEY (SheetID) REFERENCES Sheets(SheetID),
    CONSTRAINT FK_Inventory_Warehouse FOREIGN KEY (WarehouseID) REFERENCES Warehouses(WarehouseID)
);

CREATE TABLE Logs
(
	LogID INT IDENTITY(1,1) PRIMARY KEY,
	LogDTime DATETIME NOT NULL,
	LogType INT(1) NOT NULL COMMENT '1 add, 2 edit, 3 delete, 4 verify/confirm, 5 view, 6 print, 0 log in/out',
	UserID INT(4) NOT NULL,
	TableName VARCHAR(50) NOT NULL,
	PKID INT(6) NOT NULL COMMENT 'pk id of accessed data'
); 

CREATE TABLE MaintenanceLogs (
    MaintenanceID INT IDENTITY(1,1) PRIMARY KEY,
    SheetID INT NOT NULL,
    MaintenanceDate DATE NOT NULL,
    IssueReported VARCHAR(255),
    ActionTaken VARCHAR(255),
    TechnicianID INT,
    NextCheckDue DATE,
    CONSTRAINT FK_Maintenance_Sheets FOREIGN KEY (SheetID) REFERENCES Sheets(SheetID),
    CONSTRAINT FK_Maintenance_Tech FOREIGN KEY (TechnicianID) REFERENCES Employees(EmployeeID)
);

CREATE TABLE Manufacturers
(
	ManuID	INT IDENTITY(1,1) PRIMARY KEY,
	ManuName VARCHAR(150) NOT NULL,
	ManuAddress VARCHAR(255) NOT NULL,
);

-- notes for sheets
CREATE TABLE Notes
(
	NoteID INT IDENTITY(1,1) PRIMARY KEY,
	NoteDesc VARCHAR(MAX) NOT NULL,
	NoteDate DATE NOT NULL,
	SheetID INT NOT NULL,
	NotedByID INT NOT NULL,
	CONSTRAINT FK_Notes_Sheets FOREIGN KEY (SheetID) REFERENCES Sheets(SheetID),
	CONSTRAINT FK_Notes_Users FOREIGN KEY (NotedByID) REFERENCES Users(UserID)
);

CREATE TABLE Projects
(
	ProjectID INT IDENTITY(1,1) PRIMARY KEY,
	ClientID INT NOT NULL,
	ClientProjNum VARCHAR(15) NOT NULL,
	ProjNum VARCHAR(15) NOT NULL,
	ProjName VARCHAR(255) NOT NULL,
	ProjDesc VARCHAR(255) NOT NULL,
	ManagerID INT NOT NULL,
	StartDate DATE NOT NULL,
	EndDate DATE NULL,
	CONSTRAINT FK_Projects_Clients FOREIGN KEY (ClientID) REFERENCES Clients(ClientID),
	CONSTRAINT FK_Projects_Employees FOREIGN KEY (ManagerID) REFERENCES Employees(EmployeeID)
);

CREATE TABLE Roles
(
	RoleID	INT IDENTITY(1,1) PRIMARY KEY,
	RoleName VARCHAR(255) NOT NULL,
	RoleDesc VARCHAR(255) NOT NULL
);

CREATE TABLE RolesActions
(
	RAID	INT IDENTITY(1,1) PRIMARY KEY,
	RoleID INT NOT NULL,
	ActionID INT NOT NULL,
	CONSTRAINT FK_RA_Roles FOREIGN KEY (RoleID) REFERENCES Roles(RoleID),
	CONSTRAINT FK_RA_Actions FOREIGN KEY (ActionID) REFERENCES Actions(ActionID)
);

CREATE TABLE Sessions
(
	UserSessionID INT IDENTITY(1,1) PRIMARY KEY,
	UserID INT NOT NULL,
	SessionID VARCHAR(255) NOT NULL,
	SessionKey VARCHAR(32) NOT NULL,
	SessionToken VARCHAR(32) NOT NULL,
	Activity INT NOT NULL,
	SessionIP VARCHAR(32) NOT NULL,
	ReferenceURL VARCHAR(32)
);

-- Sheets are the overall information for each part
CREATE TABLE Sheets 
(
	SheetID	INT IDENTITY(1,1) PRIMARY KEY,
	SheetName VARCHAR(255) NOT NULL UNIQUE, -- for english
	SheetNameFr VARCHAR(255) NOT NULL UNIQUE, -- for french
	SheetDesc VARCHAR(255) NOT NULL, -- for english
	SheetDescFr VARCHAR(255) NOT NULL, -- for french
	SheetDesc2 VARCHAR(255) NOT NULL, -- for english
	SheetDescFr2 VARCHAR(255) NOT NULL, -- for french
	ClientDocNum INT NULL, -- client document number
	CompanyDocNum INT NULL, -- Company is a company name, this can be updated. DocNum means document number
	AreaID INT NOT NULL,
	PackageName VARCHAR(100) NOT NULL,
	RevisionNum INT NOT NULL,
	RevisionDate DATE NOT NULL,
	PreparedByID INT NOT NULL,
	PreparedByDate DATE NOT NULL,
	VerifiedByID INT NULL,
	VerifiedByDate DATE NULL,
	ApprovedByID INT NULL,
	ApprovedByDate DATE NULL,
	EquipmentName VARCHAR(150) NOT NULL UNIQUE,
	EquipmentTagNum VARCHAR(150) NOT NULL UNIQUE, 
	ServiceName VARCHAR(150) NOT NULL, 
	RequiredQty INT NOT NULL,
	ItemLocation VARCHAR(255) NOT NULL, 
	ManuID INT NOT NULL,
	SuppID INT NOT NULL,
	InstallPackNum VARCHAR(100) NOT NULL, 
	EquipSize INT NOT NULL,
	ModelNum VARCHAR(50) NOT NULL, 
	Driver VARCHAR(150) NULL, 
	LocationDwg VARCHAR(255) NULL, 
	PID INT NOT NULL,
	InstallDwg VARCHAR(255) NULL, -- installation drawing
	CodeStd VARCHAR(255) NULL, 
	CategoryID INT NULL,
	ProjectID INT NULL,
	CONSTRAINT FK_Sheets_Categories FOREIGN KEY (CategoryID) REFERENCES Categories(CategoryID),
	CONSTRAINT FK_Sheets_Areas FOREIGN KEY (AreaID) REFERENCES Areas(AreaID),
	CONSTRAINT FK_PreparedBy FOREIGN KEY (PreparedByID) REFERENCES Employees(EmployeeID),
	CONSTRAINT FK_VerifiedBy FOREIGN KEY (VerifiedByID) REFERENCES Employees(EmployeeID),
	CONSTRAINT FK_ApprovedBy FOREIGN KEY (ApprovedByID) REFERENCES Employees(EmployeeID),
	CONSTRAINT FK_Sheets_Projects FOREIGN KEY (ProjectID) REFERENCES Projects(ProjectID),
	CONSTRAINT FK_Sheets_Manufacturers FOREIGN KEY (ManuID) REFERENCES Manufacturers(ManuID),
	CONSTRAINT FK_Sheets_Suppliers FOREIGN KEY (SuppID) REFERENCES Suppliers(SuppID)
);

-- SubSheets are a grouped information inside a sheet 
CREATE TABLE SubSheets
(
	SubID INT IDENTITY(1,1) PRIMARY KEY,
	SubName VARCHAR(150) NOT NULL,
	SubNameFr VARCHAR(150) NOT NULL,
	SheetID INT NOT NULL,
	CONSTRAINT FK_SubSheets_Sheets FOREIGN KEY (SheetID) REFERENCES Sheets(SheetID)
);

-- these are pre-defined values intended for an information
CREATE TABLE Suggestions
(
	SuggID INT IDENTITY(1,1) PRIMARY KEY,
	InfoID INT NOT NULL,
	SuggValue VARCHAR(150) NOT NULL,
	CONSTRAINT FK_Suggestions_Information FOREIGN KEY (InfoID) REFERENCES Information(InfoID)
);

CREATE TABLE Suppliers
(
	SuppID	INT IDENTITY(1,1) PRIMARY KEY,
	SuppName VARCHAR(150) NOT NULL,
	SuppAddress VARCHAR(255) NOT NULL,
);

CREATE TABLE Translations (
    TranslationID INT IDENTITY(1,1) PRIMARY KEY,
    EntityType VARCHAR(50) NOT NULL, -- e.g., 'Sheet', 'SubSheet', 'Label'
    EntityID INT NOT NULL,
    LanguageCode VARCHAR(10) NOT NULL, -- e.g., 'en', 'fr', 'de'
    FieldName VARCHAR(100) NOT NULL,
    TranslatedText VARCHAR(255) NOT NULL
);

-- Units can be SI or USC
CREATE TABLE Units
(
	UnitID	INT IDENTITY(1,1) PRIMARY KEY,
	UnitSystem VARCHAR(10) NOT NULL,
	UnitCode VARCHAR(20) NOT NULL,
	UnitName VARCHAR(50) NOT NULL
);

CREATE TABLE Users
(
	UserID INT IDENTITY(1,1) PRIMARY KEY,
	FirstName VARCHAR(30) NOT NULL,
	LastName VARCHAR(30) NOT NULL,
	UserName NVARCHAR(50) NOT NULL,
	Password NVARCHAR(50) NOT NULL,
	--HashedPassword VARBINARY(64) NOT NULL,
	--Salt UNIQUEIDENTIFIER NOT NULL,
	UserLevel INT NOT NULL,
	UserPicture VARCHAR(50) NOT NULL,
	UserTheme VARCHAR(20) NOT NULL,
	LastLogin DATETIME NULL,
	LastIP VARCHAR(255) NOT NULL,
	LoginErrors INT NOT NULL,
	Active INT
);

CREATE TABLE UserRoles
(
	UserRoleID	INT IDENTITY(1,1) PRIMARY KEY,
	UserID INT NOT NULL,
	RoleID INT NOT NULL
	CONSTRAINT FK_UR_Users FOREIGN KEY (UserID) REFERENCES Users(UserID),
	CONSTRAINT FK_UR_Roles FOREIGN KEY (RoleID) REFERENCES Roles(RoleID)
);

CREATE TABLE Warehouses (
    WarehouseID INT IDENTITY(1,1) PRIMARY KEY,
    WarehouseName VARCHAR(100) NOT NULL,
    Location VARCHAR(255) NOT NULL
);

/*******************************************************************************************
INSERT DATA
*******************************************************************************************/

INSERT INTO Units (UnitSystem, UnitCode, UnitName)
VALUES('SI', 'm', 'meter'), 
('SI', 'km', 'kilometer'), 
('SI', 'cm', 'centimiter'), 
('SI', 'm^2', 'square meter'), 
('SI', 'km^2', 'square kilometer'), 
('SI', 'cm^2', 'square centimeter'), 
('SI', 'L', 'liter'), 
('SI', 'm^3', 'cubic meter'), 
('SI', 'mL', 'milliliter'), 
('SI', 'kg', 'kilogram'), 
('SI', 'g', 'gram'), 
('SI', 'mg', 'milligram'), 
('SI', 'C', 'celsius'), 
('SI', 'Pa', 'Pascal'), 
('SI', 'atm', 'atmosphere'), 
('SI', 'm/s', 'meter per second'), 
('SI', 'km/h', 'kilometer per hour'), 
('SI', 'N', 'Newton'), 
('SI', 'J', 'Joule'), 
('SI', 'kg/m^3', 'kilogram per cubic meter'),
('SI', 'm^3/m', 'cubic meter per minute'),
('SI', 'kW', 'kilowatt'),
('USC', 'in', 'inches'), 
('USC', 'mi', 'miles'), 
('USC', 'in^2', 'square inches'), 
('USC', 'mi^2', 'square miles'), 
('USC', 'gal', 'gallons'), 
('USC', 'ft^3', 'cubic feet'), 
('USC', 'fl oz', 'fluid ounces'), 
('USC', 'lb', 'pounds'), 
('USC', 'oz', 'ounces'), 
('USC', 'grains', 'gr'), 
('USC', 'F', 'Farenheit'), 
('USC', 'psi', 'pounds per square inch'), 
('USC', 'ft/s', 'feet per second'), 
('USC', 'mph', 'miles per hour'), 
('USC', 'lbf', 'pounds-force'), 
('USC', 'cal', 'calories'), 
('USC', 'BTU', 'British Thermal Units'),
('USC', 'lb/ft^3', 'pound per cubic feet'),
('USC', 'ft^3/m', 'cubic feet per minute'),
('USC', 'hp', 'horsepower');

INSERT INTO Conversions (SiUomCode, SiUomName, UscUomCode, UscUomName)
VALUES('m', 'meter', 'in', 'inches'),
('km', 'kilometer', 'mi', 'miles'),
('cm', 'centimeter', 'in', 'inches'),
('m^2', 'square meter', 'in^2', 'square inch'),
('km^2', 'square kilometer', 'mi^2', 'square miles'),
('cm^2', 'square centimeter', 'in^2', 'square inch'),
('L', 'liter', 'gal', 'gallons'),
('m^3', 'cubic meter', 'ft^3', 'cubic feet'),
('mL', 'milliliter', 'fl oz', 'fluid ounce'),
('kg', 'kilogram', 'lb', 'pound'),
('g', 'gram', 'oz', 'ounce'),
('mg', 'milligram', 'gr', 'grains'),
('C', 'Celsius', 'F', 'Fahrenheit'),
('Pa', 'Pascal', 'psi', 'pounds per square inch'),
('kPa', 'kilopascal', 'psi', 'pounds per square inch'),
('atm', 'atmosphere', 'psi', 'pounds per square inch'),
('m/s', 'meter per second', 'ft/s', 'feet per second'),
('km/h', 'kilometer per hour', 'mph', 'miles per hour'),
('N', 'Newton', 'lbf', 'pounds-force'),
('J', 'Joule', 'cal', 'calories'),
('J', 'Joule', 'BTU', 'British Thermal Units'),
('kW', 'kilowatt', 'hp', 'horsepower'),
('kPa(g)', 'kilopascal with gravity', 'psi(g)', 'pounds per square inch with gravity');


INSERT INTO Users (FirstName, LastName, Username, Password, UserLevel, UserPicture, UserTheme, LastLogin, LastIP, LoginErrors, Active)
VALUES ('Jeff Martin', 'Abayon', 'jmjabayon@gmail.com', 'password123', 1, '', 'azure', GETDATE(), '', 0, 1);
INSERT INTO Users (FirstName, LastName, Username, Password, UserLevel, UserPicture, UserTheme, LastLogin, LastIP, LoginErrors, Active)
VALUES ('Leslie', 'Uy', 'leslieuy73@gmail.com', 'password123', 1, '', 'purple', GETDATE(), '', 0, 1);

INSERT INTO Clients (ClientCode, ClientName, ClientEmail, ClientPhone, ClientAddress, ContactPerson, ClientLogo)
VALUES ('C001', 'Client One', 'clientone@gmail.com', '(403)-001-0101', 'Client Address One', 'Contact One', 'client1.png'),
('C002', 'Client Two', 'clienttow@gmail.com', '(403)-002-0202', 'Client Address Two', 'Contact Two', 'client2.png'),
('C003', 'Client Three', 'clientthree@gmail.com', '(403)-003-0303', 'Client Address Three', 'Contact Three', 'client3.png'),

INSERT INTO Projects ( ClientID, ClientProjNum, ProjNum, ProjName, ProjDesc, ManagerID, StartDate, EndDate )
VALUES( 1, '10-100', '01-001', 'Project Client 1a', 'Project 1a Description', 4, '2023-06-01', NULL ),
( 1, '10-200', '01-002', 'Project Client 1b', 'Project 1b Description', 4, '2023-07-01', NULL ),
( 2, '20-100', '02-001', 'Project Client 2', 'Project 2 Description', 5, '2023-06-01', NULL ),
( 3, '30-100', '03-001', 'Project Client 3', 'Project 3 Description', 5, '2023-06-01', NULL );





























DECLARE @username NVARCHAR(50) = 'leslieuy73@gmail.com';
DECLARE @plainPassword NVARCHAR(50) = 'password123';
DECLARE @salt UNIQUEIDENTIFIER = NEWID();
DECLARE @hashedPassword VARBINARY(16);
SET @hashedPassword = HASHBYTES('MD5', CONVERT(NVARCHAR(50), @salt) + @plainPassword);
INSERT INTO Users (FirstName, LastName, Username, HashedPassword, UserLevel, UserPicture, UserTheme, LastLogin, LastIP, LoginErrors, Active)
VALUES ('Leslie', 'Uy', 'leslieuy73@gmail.com', @hashedPassword, 1, '', 'purple', GETDATE(), '', 0, 1);

DECLARE @username NVARCHAR(50) = 'jmjabayon@gmail.com';
DECLARE @plainPassword NVARCHAR(50) = 'password123';
DECLARE @salt UNIQUEIDENTIFIER = NEWID();
DECLARE @hashedPassword VARBINARY(16);
SET @hashedPassword = HASHBYTES('SHA2_256', CONVERT(NVARCHAR(50), @salt) + @plainPassword);
INSERT INTO Users (FirstName, LastName, Username, HashedPassword, UserLevel, UserPicture, UserTheme, LastLogin, LastIP, LoginErrors, Active)
VALUES ('Jeff Martin', 'Abayon', 'jmjabayon@gmail.com', @hashedPassword, 1, '', 'azure', GETDATE(), '', 0, 1);


DECLARE @password NVARCHAR(50) = 'password123';
DECLARE @hashedPassword VARBINARY(64);
SET @hashedPassword = HASHBYTES('SHA2_256', @password);
INSERT INTO Users (FirstName, LastName, Username, HashedPassword, UserLevel, UserPicture, UserTheme, LastLogin, LastIP, LoginErrors, Active)
VALUES ('Jeff Martin', 'Abayon', 'jmjabayon@gmail.com', @hashedPassword, 1, '', 'azure', GETDATE(), '', 0, 1);
--
DECLARE @password NVARCHAR(50) = 'password123';
DECLARE @hashedPassword VARBINARY(64);
SET @hashedPassword = HASHBYTES('SHA2_256', @password);
INSERT INTO Users (FirstName, LastName, Username, HashedPassword, UserLevel, UserPicture, UserTheme, LastLogin, LastIP, LoginErrors, Active)
VALUES ('Leslie', 'Uy', 'leslieuy73@gmail.com', @hashedPassword, 1, '', 'purple', GETDATE(), '', 0, 1);



