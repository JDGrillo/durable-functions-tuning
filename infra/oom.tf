# ─── OOM Payload Comparison Scenario ──────────────────────────
# This file adds resources for the inline-payloads (anti-pattern) and
# externalized-payloads (best practice) function apps.

# ─── Storage Accounts (OOM scenario) ─────────────────────────

# Inline-payloads task hub storage
resource "azurerm_storage_account" "inline_taskhub" {
  name                            = "${local.name_prefix}iltask"
  location                        = azurerm_resource_group.rg.location
  resource_group_name             = azurerm_resource_group.rg.name
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false
  tags                            = merge(var.tags, { role = "inline-taskhub" })
}

# Externalized-payloads task hub storage
resource "azurerm_storage_account" "externalized_taskhub" {
  name                            = "${local.name_prefix}extask"
  location                        = azurerm_resource_group.rg.location
  resource_group_name             = azurerm_resource_group.rg.name
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false
  tags                            = merge(var.tags, { role = "externalized-taskhub" })
}

# Inline-payloads workload blob storage
resource "azurerm_storage_account" "inline_blobs" {
  name                            = "${local.name_prefix}ilblob"
  location                        = azurerm_resource_group.rg.location
  resource_group_name             = azurerm_resource_group.rg.name
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false
  tags                            = merge(var.tags, { role = "inline-workload-blobs" })
}

# Externalized-payloads workload blob storage
resource "azurerm_storage_account" "externalized_blobs" {
  name                            = "${local.name_prefix}exblob"
  location                        = azurerm_resource_group.rg.location
  resource_group_name             = azurerm_resource_group.rg.name
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false
  tags                            = merge(var.tags, { role = "externalized-workload-blobs" })
}

# ─── Blob Containers (OOM scenario) ──────────────────────────

resource "azurerm_storage_container" "inline_input" {
  name                  = "input"
  storage_account_id    = azurerm_storage_account.inline_blobs.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "inline_output" {
  name                  = "output"
  storage_account_id    = azurerm_storage_account.inline_blobs.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "externalized_input" {
  name                  = "input"
  storage_account_id    = azurerm_storage_account.externalized_blobs.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "externalized_output" {
  name                  = "output"
  storage_account_id    = azurerm_storage_account.externalized_blobs.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "externalized_intermediate" {
  name                  = "intermediate-payloads"
  storage_account_id    = azurerm_storage_account.externalized_blobs.id
  container_access_type = "private"
}

# ─── User-Assigned Managed Identities (OOM scenario) ─────────

resource "azurerm_user_assigned_identity" "inline" {
  name                = "id-${local.name_prefix}-inline"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags
}

resource "azurerm_user_assigned_identity" "externalized" {
  name                = "id-${local.name_prefix}-externalized"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags
}

# ─── RBAC Role Assignments (OOM scenario) ─────────────────────

# Inline identity → inline task hub storage
resource "azurerm_role_assignment" "inline_taskhub_blob" {
  scope                = azurerm_storage_account.inline_taskhub.id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = azurerm_user_assigned_identity.inline.principal_id
}

resource "azurerm_role_assignment" "inline_taskhub_queue" {
  scope                = azurerm_storage_account.inline_taskhub.id
  role_definition_name = "Storage Queue Data Contributor"
  principal_id         = azurerm_user_assigned_identity.inline.principal_id
}

resource "azurerm_role_assignment" "inline_taskhub_table" {
  scope                = azurerm_storage_account.inline_taskhub.id
  role_definition_name = "Storage Table Data Contributor"
  principal_id         = azurerm_user_assigned_identity.inline.principal_id
}

# Inline identity → inline workload blob storage
resource "azurerm_role_assignment" "inline_blobs" {
  scope                = azurerm_storage_account.inline_blobs.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.inline.principal_id
}

# Externalized identity → externalized task hub storage
resource "azurerm_role_assignment" "externalized_taskhub_blob" {
  scope                = azurerm_storage_account.externalized_taskhub.id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = azurerm_user_assigned_identity.externalized.principal_id
}

resource "azurerm_role_assignment" "externalized_taskhub_queue" {
  scope                = azurerm_storage_account.externalized_taskhub.id
  role_definition_name = "Storage Queue Data Contributor"
  principal_id         = azurerm_user_assigned_identity.externalized.principal_id
}

resource "azurerm_role_assignment" "externalized_taskhub_table" {
  scope                = azurerm_storage_account.externalized_taskhub.id
  role_definition_name = "Storage Table Data Contributor"
  principal_id         = azurerm_user_assigned_identity.externalized.principal_id
}

# Externalized identity → externalized workload blob storage
resource "azurerm_role_assignment" "externalized_blobs" {
  scope                = azurerm_storage_account.externalized_blobs.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.externalized.principal_id
}

# ─── Premium v3 P0V3 Plans (OOM scenario) ────────────────────

resource "azurerm_service_plan" "inline_plan" {
  name                = "plan-${local.name_prefix}-inline"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  os_type             = "Linux"
  sku_name            = "P0v3"
  tags                = var.tags
}

resource "azurerm_service_plan" "externalized_plan" {
  name                = "plan-${local.name_prefix}-externalized"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  os_type             = "Linux"
  sku_name            = "P0v3"
  tags                = var.tags
}

# ─── Function Apps (OOM scenario) ────────────────────────────

resource "azurerm_linux_function_app" "inline" {
  name                                           = "func-${local.name_prefix}-inline"
  location                                       = azurerm_resource_group.rg.location
  resource_group_name                            = azurerm_resource_group.rg.name
  service_plan_id                                = azurerm_service_plan.inline_plan.id
  storage_account_name                           = azurerm_storage_account.inline_taskhub.name
  storage_uses_managed_identity                  = true
  content_share_force_disabled                   = true
  ftp_publish_basic_authentication_enabled       = false
  webdeploy_publish_basic_authentication_enabled = false
  virtual_network_subnet_id                      = azurerm_subnet.inline.id
  tags                                           = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.inline.id]
  }

  key_vault_reference_identity_id = azurerm_user_assigned_identity.inline.id

  site_config {
    vnet_route_all_enabled                 = true
    application_insights_connection_string = azurerm_application_insights.appinsights.connection_string

    application_stack {
      node_version = "22"
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME              = "node"
    AzureWebJobsStorage__accountName      = azurerm_storage_account.inline_taskhub.name
    AzureWebJobsStorage__credential       = "managedidentity"
    AzureWebJobsStorage__clientId         = azurerm_user_assigned_identity.inline.client_id
    AZURE_CLIENT_ID                       = azurerm_user_assigned_identity.inline.client_id
    BLOB_STORAGE_ACCOUNT_NAME             = azurerm_storage_account.inline_blobs.name
    BLOB_INPUT_CONTAINER                  = "input"
    BLOB_OUTPUT_CONTAINER                 = "output"
    APP_NAME                              = "inline-payloads"
    WEBSITE_RUN_FROM_PACKAGE              = "1"
  }

  depends_on = [time_sleep.rbac_propagation_oom, azurerm_private_endpoint.storage]
}

resource "azurerm_linux_function_app" "externalized" {
  name                                           = "func-${local.name_prefix}-externalized"
  location                                       = azurerm_resource_group.rg.location
  resource_group_name                            = azurerm_resource_group.rg.name
  service_plan_id                                = azurerm_service_plan.externalized_plan.id
  storage_account_name                           = azurerm_storage_account.externalized_taskhub.name
  storage_uses_managed_identity                  = true
  content_share_force_disabled                   = true
  ftp_publish_basic_authentication_enabled       = false
  webdeploy_publish_basic_authentication_enabled = false
  virtual_network_subnet_id                      = azurerm_subnet.externalized.id
  tags                                           = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.externalized.id]
  }

  key_vault_reference_identity_id = azurerm_user_assigned_identity.externalized.id

  site_config {
    vnet_route_all_enabled                 = true
    application_insights_connection_string = azurerm_application_insights.appinsights.connection_string

    application_stack {
      node_version = "22"
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME              = "node"
    AzureWebJobsStorage__accountName      = azurerm_storage_account.externalized_taskhub.name
    AzureWebJobsStorage__credential       = "managedidentity"
    AzureWebJobsStorage__clientId         = azurerm_user_assigned_identity.externalized.client_id
    AZURE_CLIENT_ID                       = azurerm_user_assigned_identity.externalized.client_id
    BLOB_STORAGE_ACCOUNT_NAME             = azurerm_storage_account.externalized_blobs.name
    BLOB_INPUT_CONTAINER                  = "input"
    BLOB_OUTPUT_CONTAINER                 = "output"
    BLOB_INTERMEDIATE_CONTAINER           = "intermediate-payloads"
    APP_NAME                              = "externalized-payloads"
    WEBSITE_RUN_FROM_PACKAGE              = "1"
  }

  depends_on = [time_sleep.rbac_propagation_oom, azurerm_private_endpoint.storage]
}

# ─── RBAC Propagation Delay (OOM scenario) ────────────────────
resource "time_sleep" "rbac_propagation_oom" {
  create_duration = "60s"

  depends_on = [
    azurerm_role_assignment.inline_taskhub_blob,
    azurerm_role_assignment.inline_taskhub_queue,
    azurerm_role_assignment.inline_taskhub_table,
    azurerm_role_assignment.inline_blobs,
    azurerm_role_assignment.externalized_taskhub_blob,
    azurerm_role_assignment.externalized_taskhub_queue,
    azurerm_role_assignment.externalized_taskhub_table,
    azurerm_role_assignment.externalized_blobs,
  ]
}
