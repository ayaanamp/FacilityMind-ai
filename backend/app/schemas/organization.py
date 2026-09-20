"""Pydantic schemas for Organization profile, onboarding, and equipment inventory."""

from pydantic import BaseModel, Field


class OrganizationSetupRequest(BaseModel):
    """Payload for initializing a clean organization workspace on first run."""

    admin_name: str = Field(..., min_length=2, max_length=100)
    admin_username: str = Field(..., min_length=2, max_length=100, description="Administrator login username")
    admin_password: str = Field(..., min_length=3, max_length=150, description="Administrator login password")
    admin_email: str | None = Field(None, max_length=150)
    admin_role: str = Field(default="Facility Manager", max_length=100)
    admin_phone: str | None = Field(None, max_length=50)
    organization_name: str = Field(..., min_length=2, max_length=150)
    org_type: str = Field(default="College", max_length=100)
    custom_org_type: str | None = Field(None, max_length=100)
    country: str = Field(default="India", max_length=100)
    state: str = Field(default="", max_length=100)
    city: str = Field(default="", max_length=100)
    primary_location: str = Field(default="", max_length=200)
    buildings_count: int = Field(default=1, ge=1)
    floors_count: int = Field(default=1, ge=1)
    approx_users_count: int = Field(default=0, ge=0)
    operating_hours: str = Field(default="24/7 Operations", max_length=100)
    categories: list[str] = Field(default_factory=list)
    blocks: list[str] = Field(default_factory=list)
    gemini_api_key: str | None = Field(None)
    load_demo_data: bool = Field(default=False)


class OrganizationUpdateRequest(BaseModel):
    """Payload for updating organization settings."""

    name: str | None = None
    org_type: str | None = None
    custom_org_type: str | None = None
    country: str | None = None
    state: str | None = None
    city: str | None = None
    primary_location: str | None = None
    admin_name: str | None = None
    admin_username: str | None = None
    admin_password: str | None = None
    admin_email: str | None = None
    admin_role: str | None = None
    admin_phone: str | None = None
    buildings_count: int | None = None
    floors_count: int | None = None
    approx_users_count: int | None = None
    operating_hours: str | None = None
    categories: list[str] | None = None
    blocks: list[str] | None = None
    gemini_api_key: str | None = None


class AdminCredentialsUpdateRequest(BaseModel):
    """Dedicated payload for updating administrator profile name, login username, and password."""

    admin_name: str = Field(..., min_length=2, max_length=100)
    admin_username: str = Field(..., min_length=2, max_length=100)
    admin_password: str | None = Field(None, min_length=3, max_length=150)



class OrganizationPublicOut(BaseModel):
    """Clean public organization profile for User Portal (No secrets/credentials)."""

    name: str
    org_type: str
    primary_location: str
    operating_hours: str
    categories: list[str] = Field(default_factory=list)
    blocks: list[str] = Field(default_factory=list)
    emergency_phone: str = "+91 (080) 4122-3900"
    setup_completed: bool = True


class OrganizationOut(BaseModel):
    """Administrator view of organization configuration."""

    id: int
    name: str
    org_type: str
    custom_org_type: str | None = None
    country: str
    state: str
    city: str
    primary_location: str
    admin_name: str
    admin_email: str | None = None
    admin_role: str
    admin_phone: str | None = None
    buildings_count: int
    floors_count: int
    approx_users_count: int
    operating_hours: str
    categories: list[str] = Field(default_factory=list)
    blocks: list[str] = Field(default_factory=list)
    gemini_api_key_configured: bool
    setup_completed: bool
    created_at: str
    updated_at: str


class WorkspaceStats(BaseModel):
    """Real-time entity counts for the organization."""

    complaints_count: int = 0
    active_complaints_count: int = 0
    resolved_complaints_count: int = 0
    equipment_count: int = 0
    maintenance_records_count: int = 0
    technicians_count: int = 0


class OrganizationStatusResponse(BaseModel):
    """Status check for first-run onboarding."""

    setup_completed: bool
    is_fresh_install: bool
    organization: OrganizationOut | None = None
    stats: WorkspaceStats = Field(default_factory=WorkspaceStats)
    suggested_categories: list[str] = Field(default_factory=list)


class EquipmentCreate(BaseModel):
    """Payload for creating a new equipment asset."""

    equipment_name: str = Field(..., min_length=2, max_length=150)
    equipment_type: str = Field(..., min_length=2, max_length=100)
    equipment_id: str = Field(..., min_length=2, max_length=50)
    location: str = Field(..., min_length=2, max_length=150)
    building: str | None = ""
    floor: str | None = ""
    department: str | None = ""
    manufacturer: str | None = ""
    model: str | None = ""
    serial_number: str | None = ""
    installation_date: str | None = ""
    status: str = "Operational"
    criticality: str = "Medium"


class EquipmentOut(BaseModel):
    """Output schema for equipment asset."""

    id: int
    organization_id: int | None = None
    equipment_name: str
    equipment_type: str
    equipment_id: str
    location: str
    building: str | None = ""
    floor: str | None = ""
    department: str | None = ""
    manufacturer: str | None = ""
    model: str | None = ""
    serial_number: str | None = ""
    installation_date: str | None = ""
    status: str
    criticality: str
    created_at: str


class ApiKeyVerifyRequest(BaseModel):
    """Payload to test a Gemini API Key."""

    api_key: str = Field(..., min_length=10)


class ApiKeyVerifyResponse(BaseModel):
    """Result of testing Gemini API Key."""

    valid: bool
    message: str


class EquipmentCsvImportRequest(BaseModel):
    """Payload for importing equipment inventory via CSV content."""

    csv_content: str = Field(..., min_length=1)
