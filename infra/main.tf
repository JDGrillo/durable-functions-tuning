# ─── Random Suffix ────────────────────────────────────────────
resource "random_string" "suffix" {
  length  = 4
  upper   = false
  special = false
}

locals {
  name_prefix = "${var.resource_prefix}${random_string.suffix.result}"
}

# ─── Resource Group ───────────────────────────────────────────
resource "azurerm_resource_group" "rg" {
  name     = "rg-${local.name_prefix}"
  location = var.location
  tags     = var.tags
}

# ─── Log Analytics Workspace ─────────────────────────────────
resource "azurerm_log_analytics_workspace" "law" {
  name                = "law-${local.name_prefix}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

# ─── Application Insights (shared) ───────────────────────────
resource "azurerm_application_insights" "appinsights" {
  name                = "ai-${local.name_prefix}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  workspace_id        = azurerm_log_analytics_workspace.law.id
  application_type    = "Node.JS"
  tags                = var.tags
}

# ─── Storage Accounts ────────────────────────────────────────
# Baseline task hub storage (Tables + Queues for Durable Functions)
resource "azurerm_storage_account" "baseline_taskhub" {
  name                            = "${local.name_prefix}bltask"
  location                        = azurerm_resource_group.rg.location
  resource_group_name             = azurerm_resource_group.rg.name
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false
  tags                            = merge(var.tags, { role = "baseline-taskhub" })
}

# Tuned task hub storage
resource "azurerm_storage_account" "tuned_taskhub" {
  name                            = "${local.name_prefix}tntask"
  location                        = azurerm_resource_group.rg.location
  resource_group_name             = azurerm_resource_group.rg.name
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false
  tags                            = merge(var.tags, { role = "tuned-taskhub" })
}

# Baseline workload blob storage (I/O target for activities)
resource "azurerm_storage_account" "baseline_blobs" {
  name                            = "${local.name_prefix}blblob"
  location                        = azurerm_resource_group.rg.location
  resource_group_name             = azurerm_resource_group.rg.name
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false
  tags                            = merge(var.tags, { role = "baseline-workload-blobs" })
}

# Tuned workload blob storage
resource "azurerm_storage_account" "tuned_blobs" {
  name                            = "${local.name_prefix}tnblob"
  location                        = azurerm_resource_group.rg.location
  resource_group_name             = azurerm_resource_group.rg.name
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false
  tags                            = merge(var.tags, { role = "tuned-workload-blobs" })
}

# Blob containers for workload I/O
resource "azurerm_storage_container" "baseline_input" {
  name                  = "input"
  storage_account_id    = azurerm_storage_account.baseline_blobs.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "baseline_output" {
  name                  = "output"
  storage_account_id    = azurerm_storage_account.baseline_blobs.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "tuned_input" {
  name                  = "input"
  storage_account_id    = azurerm_storage_account.tuned_blobs.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "tuned_output" {
  name                  = "output"
  storage_account_id    = azurerm_storage_account.tuned_blobs.id
  container_access_type = "private"
}

# ─── User-Assigned Managed Identities ────────────────────────
resource "azurerm_user_assigned_identity" "baseline" {
  name                = "id-${local.name_prefix}-baseline"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags
}

resource "azurerm_user_assigned_identity" "tuned" {
  name                = "id-${local.name_prefix}-tuned"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags
}

# ─── Role Assignments (Managed Identity → Storage) ──────────
# These must be created BEFORE the function apps so the identity
# already has storage access when the app is provisioned.

# Baseline identity → baseline task hub storage
resource "azurerm_role_assignment" "baseline_taskhub_blob" {
  scope                = azurerm_storage_account.baseline_taskhub.id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = azurerm_user_assigned_identity.baseline.principal_id
}

resource "azurerm_role_assignment" "baseline_taskhub_queue" {
  scope                = azurerm_storage_account.baseline_taskhub.id
  role_definition_name = "Storage Queue Data Contributor"
  principal_id         = azurerm_user_assigned_identity.baseline.principal_id
}

resource "azurerm_role_assignment" "baseline_taskhub_table" {
  scope                = azurerm_storage_account.baseline_taskhub.id
  role_definition_name = "Storage Table Data Contributor"
  principal_id         = azurerm_user_assigned_identity.baseline.principal_id
}

# Baseline identity → baseline workload blob storage
resource "azurerm_role_assignment" "baseline_blobs" {
  scope                = azurerm_storage_account.baseline_blobs.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.baseline.principal_id
}

# Tuned identity → tuned task hub storage
resource "azurerm_role_assignment" "tuned_taskhub_blob" {
  scope                = azurerm_storage_account.tuned_taskhub.id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = azurerm_user_assigned_identity.tuned.principal_id
}

resource "azurerm_role_assignment" "tuned_taskhub_queue" {
  scope                = azurerm_storage_account.tuned_taskhub.id
  role_definition_name = "Storage Queue Data Contributor"
  principal_id         = azurerm_user_assigned_identity.tuned.principal_id
}

resource "azurerm_role_assignment" "tuned_taskhub_table" {
  scope                = azurerm_storage_account.tuned_taskhub.id
  role_definition_name = "Storage Table Data Contributor"
  principal_id         = azurerm_user_assigned_identity.tuned.principal_id
}

# Tuned identity → tuned workload blob storage
resource "azurerm_role_assignment" "tuned_blobs" {
  scope                = azurerm_storage_account.tuned_blobs.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.tuned.principal_id
}

# ─── RBAC Propagation Delay ───────────────────────────────────
# Azure AD role assignments can take up to 60s to propagate.
# This ensures the identity has effective access before the
# function apps attempt to use the storage accounts.
resource "time_sleep" "rbac_propagation" {
  create_duration = "60s"

  depends_on = [
    azurerm_role_assignment.baseline_taskhub_blob,
    azurerm_role_assignment.baseline_taskhub_queue,
    azurerm_role_assignment.baseline_taskhub_table,
    azurerm_role_assignment.baseline_blobs,
    azurerm_role_assignment.tuned_taskhub_blob,
    azurerm_role_assignment.tuned_taskhub_queue,
    azurerm_role_assignment.tuned_taskhub_table,
    azurerm_role_assignment.tuned_blobs,
  ]
}

# ─── Premium v3 P0V3 Plans ───────────────────────────────────
resource "azurerm_service_plan" "baseline_plan" {
  name                = "plan-${local.name_prefix}-baseline"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  os_type             = "Linux"
  sku_name            = "P0v3"
  tags                = var.tags
}

resource "azurerm_service_plan" "tuned_plan" {
  name                = "plan-${local.name_prefix}-tuned"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  os_type             = "Linux"
  sku_name            = "P0v3"
  tags                = var.tags
}

# ─── Function Apps ───────────────────────────────────────────
resource "azurerm_linux_function_app" "baseline" {
  name                                           = "func-${local.name_prefix}-baseline"
  location                                       = azurerm_resource_group.rg.location
  resource_group_name                            = azurerm_resource_group.rg.name
  service_plan_id                                = azurerm_service_plan.baseline_plan.id
  storage_account_name                           = azurerm_storage_account.baseline_taskhub.name
  storage_uses_managed_identity                  = true
  content_share_force_disabled                   = true
  ftp_publish_basic_authentication_enabled       = false
  webdeploy_publish_basic_authentication_enabled = false
  virtual_network_subnet_id                      = azurerm_subnet.baseline.id
  tags                                           = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.baseline.id]
  }

  key_vault_reference_identity_id = azurerm_user_assigned_identity.baseline.id

  site_config {
    vnet_route_all_enabled                 = true
    application_insights_connection_string = azurerm_application_insights.appinsights.connection_string

    application_stack {
      node_version = "22"
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME              = "node"
    AzureWebJobsStorage__accountName      = azurerm_storage_account.baseline_taskhub.name
    AzureWebJobsStorage__credential       = "managedidentity"
    AzureWebJobsStorage__clientId         = azurerm_user_assigned_identity.baseline.client_id
    AZURE_CLIENT_ID                        = azurerm_user_assigned_identity.baseline.client_id
    BLOB_STORAGE_ACCOUNT_NAME             = azurerm_storage_account.baseline_blobs.name
    BLOB_INPUT_CONTAINER                  = "input"
    BLOB_OUTPUT_CONTAINER                 = "output"
    APP_NAME                              = "baseline"
    WEBSITE_RUN_FROM_PACKAGE              = "1"
  }

  depends_on = [time_sleep.rbac_propagation, azurerm_private_endpoint.storage]
}

resource "azurerm_linux_function_app" "tuned" {
  name                                           = "func-${local.name_prefix}-tuned"
  location                                       = azurerm_resource_group.rg.location
  resource_group_name                            = azurerm_resource_group.rg.name
  service_plan_id                                = azurerm_service_plan.tuned_plan.id
  storage_account_name                           = azurerm_storage_account.tuned_taskhub.name
  storage_uses_managed_identity                  = true
  content_share_force_disabled                   = true
  ftp_publish_basic_authentication_enabled       = false
  webdeploy_publish_basic_authentication_enabled = false
  virtual_network_subnet_id                      = azurerm_subnet.tuned.id
  tags                                           = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.tuned.id]
  }

  key_vault_reference_identity_id = azurerm_user_assigned_identity.tuned.id

  site_config {
    vnet_route_all_enabled                 = true
    application_insights_connection_string = azurerm_application_insights.appinsights.connection_string

    application_stack {
      node_version = "22"
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME              = "node"
    AzureWebJobsStorage__accountName      = azurerm_storage_account.tuned_taskhub.name
    AzureWebJobsStorage__credential       = "managedidentity"
    AzureWebJobsStorage__clientId         = azurerm_user_assigned_identity.tuned.client_id
    AZURE_CLIENT_ID                        = azurerm_user_assigned_identity.tuned.client_id
    BLOB_STORAGE_ACCOUNT_NAME             = azurerm_storage_account.tuned_blobs.name
    BLOB_INPUT_CONTAINER                  = "input"
    BLOB_OUTPUT_CONTAINER                 = "output"
    APP_NAME                              = "tuned"
    WEBSITE_RUN_FROM_PACKAGE              = "1"
    FUNCTIONS_WORKER_PROCESS_COUNT        = tostring(var.tuned_worker_process_count)
    NODE_OPTIONS                          = "--max-old-space-size=${var.tuned_node_max_old_space_mb}"
  }

  depends_on = [time_sleep.rbac_propagation, azurerm_private_endpoint.storage]
}

# ─── Autoscale (tuned plan only) ─────────────────────────────
resource "azurerm_monitor_autoscale_setting" "tuned_autoscale" {
  name                = "autoscale-${local.name_prefix}-tuned"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  target_resource_id  = azurerm_service_plan.tuned_plan.id
  tags                = var.tags

  depends_on = [azurerm_linux_function_app.tuned]

  profile {
    name = "default"

    capacity {
      default = var.autoscale_default_instances
      minimum = var.autoscale_min_instances
      maximum = var.autoscale_max_instances
    }

    # Scale out when average CPU > 70% for 5 minutes
    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.tuned_plan.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "GreaterThan"
        threshold          = var.autoscale_cpu_scale_out_threshold
      }
      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }

    # Scale in when average CPU < 30% for 10 minutes
    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.tuned_plan.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT10M"
        time_aggregation   = "Average"
        operator           = "LessThan"
        threshold          = var.autoscale_cpu_scale_in_threshold
      }
      scale_action {
        direction = "Decrease"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT10M"
      }
    }

    # Scale out when average memory > 80% for 5 minutes
    rule {
      metric_trigger {
        metric_name        = "MemoryPercentage"
        metric_resource_id = azurerm_service_plan.tuned_plan.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "GreaterThan"
        threshold          = var.autoscale_memory_scale_out_threshold
      }
      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }
  }
}

# ─── Azure Load Testing ─────────────────────────────────────
resource "azurerm_load_test" "loadtest" {
  name                = "alt-${local.name_prefix}"
  location            = var.load_test_location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags
}

# ─── Durable Functions Monitor ───────────────────────────────
# DFMon is deployed as two .NET 8 Isolated function apps (one per
# task hub storage account) on a shared Windows Consumption plan.
# Each instance uses managed-identity access to its respective
# task hub storage and a dedicated storage account (keys enabled)
# for the function app content share.

# Storage account for DFMon function app runtime
resource "azurerm_storage_account" "dfmon" {
  name                            = "${local.name_prefix}dfmon"
  location                        = azurerm_resource_group.rg.location
  resource_group_name             = azurerm_resource_group.rg.name
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false
  tags                            = merge(var.tags, { role = "dfmon-runtime" })
}

# Managed identity shared by both DFMon instances
resource "azurerm_user_assigned_identity" "dfmon" {
  name                = "id-${local.name_prefix}-dfmon"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags
}

# ─── DFMon RBAC → baseline task hub storage ──────────────────
resource "azurerm_role_assignment" "dfmon_baseline_blob" {
  scope                = azurerm_storage_account.baseline_taskhub.id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = azurerm_user_assigned_identity.dfmon.principal_id
}

resource "azurerm_role_assignment" "dfmon_baseline_queue" {
  scope                = azurerm_storage_account.baseline_taskhub.id
  role_definition_name = "Storage Queue Data Contributor"
  principal_id         = azurerm_user_assigned_identity.dfmon.principal_id
}

resource "azurerm_role_assignment" "dfmon_baseline_table" {
  scope                = azurerm_storage_account.baseline_taskhub.id
  role_definition_name = "Storage Table Data Contributor"
  principal_id         = azurerm_user_assigned_identity.dfmon.principal_id
}

# ─── DFMon RBAC → tuned task hub storage ─────────────────────
resource "azurerm_role_assignment" "dfmon_tuned_blob" {
  scope                = azurerm_storage_account.tuned_taskhub.id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = azurerm_user_assigned_identity.dfmon.principal_id
}

resource "azurerm_role_assignment" "dfmon_tuned_queue" {
  scope                = azurerm_storage_account.tuned_taskhub.id
  role_definition_name = "Storage Queue Data Contributor"
  principal_id         = azurerm_user_assigned_identity.dfmon.principal_id
}

resource "azurerm_role_assignment" "dfmon_tuned_table" {
  scope                = azurerm_storage_account.tuned_taskhub.id
  role_definition_name = "Storage Table Data Contributor"
  principal_id         = azurerm_user_assigned_identity.dfmon.principal_id
}

# DFMon RBAC → its own storage account (for AzureWebJobsStorage)
resource "azurerm_role_assignment" "dfmon_own_blob" {
  scope                = azurerm_storage_account.dfmon.id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = azurerm_user_assigned_identity.dfmon.principal_id
}

resource "azurerm_role_assignment" "dfmon_own_queue" {
  scope                = azurerm_storage_account.dfmon.id
  role_definition_name = "Storage Queue Data Contributor"
  principal_id         = azurerm_user_assigned_identity.dfmon.principal_id
}

resource "azurerm_role_assignment" "dfmon_own_table" {
  scope                = azurerm_storage_account.dfmon.id
  role_definition_name = "Storage Table Data Contributor"
  principal_id         = azurerm_user_assigned_identity.dfmon.principal_id
}

# RBAC propagation delay for DFMon
resource "time_sleep" "dfmon_rbac_propagation" {
  create_duration = "60s"

  depends_on = [
    azurerm_role_assignment.dfmon_baseline_blob,
    azurerm_role_assignment.dfmon_baseline_queue,
    azurerm_role_assignment.dfmon_baseline_table,
    azurerm_role_assignment.dfmon_tuned_blob,
    azurerm_role_assignment.dfmon_tuned_queue,
    azurerm_role_assignment.dfmon_tuned_table,
    azurerm_role_assignment.dfmon_own_blob,
    azurerm_role_assignment.dfmon_own_queue,
    azurerm_role_assignment.dfmon_own_table,
  ]
}

# Windows Basic plan (shared by both DFMon instances)
# Dedicated plan allows content_share_force_disabled, avoiding
# the storage-key requirement that Consumption plans impose.
resource "azurerm_service_plan" "dfmon_plan" {
  name                = "plan-${local.name_prefix}-dfmon"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  os_type             = "Windows"
  sku_name            = "B1"
  tags                = var.tags
}

# DFMon instance monitoring the baseline task hub
resource "azurerm_windows_function_app" "dfmon_baseline" {
  name                                           = "func-${local.name_prefix}-dfmon-bl"
  location                                       = azurerm_resource_group.rg.location
  resource_group_name                            = azurerm_resource_group.rg.name
  service_plan_id                                = azurerm_service_plan.dfmon_plan.id
  storage_account_name                           = azurerm_storage_account.dfmon.name
  storage_uses_managed_identity                  = true
  content_share_force_disabled                   = true
  ftp_publish_basic_authentication_enabled       = false
  webdeploy_publish_basic_authentication_enabled = false
  virtual_network_subnet_id                      = azurerm_subnet.dfmon.id
  tags                                           = merge(var.tags, { role = "dfmon-baseline" })

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.dfmon.id]
  }

  key_vault_reference_identity_id = azurerm_user_assigned_identity.dfmon.id

  site_config {
    vnet_route_all_enabled                 = true
    application_insights_connection_string = azurerm_application_insights.appinsights.connection_string

    application_stack {
      dotnet_version              = "v8.0"
      use_dotnet_isolated_runtime = true
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME         = "dotnet-isolated"
    WEBSITE_RUN_FROM_PACKAGE         = "https://www.nuget.org/api/v2/package/DurableFunctionsMonitor.DotNetIsolated"
    AzureWebJobsStorage__accountName = azurerm_storage_account.baseline_taskhub.name
    AzureWebJobsStorage__credential  = "managedidentity"
    AzureWebJobsStorage__clientId    = azurerm_user_assigned_identity.dfmon.client_id
    DFM_HUB_NAME                     = var.dfmon_baseline_hub_name
    DFM_MODE                         = "ReadOnly"
    DFM_NONCE                        = var.dfmon_nonce
  }

  depends_on = [time_sleep.dfmon_rbac_propagation, azurerm_private_endpoint.storage]
}

# DFMon instance monitoring the tuned task hub
resource "azurerm_windows_function_app" "dfmon_tuned" {
  name                                           = "func-${local.name_prefix}-dfmon-tn"
  location                                       = azurerm_resource_group.rg.location
  resource_group_name                            = azurerm_resource_group.rg.name
  service_plan_id                                = azurerm_service_plan.dfmon_plan.id
  storage_account_name                           = azurerm_storage_account.dfmon.name
  storage_uses_managed_identity                  = true
  content_share_force_disabled                   = true
  ftp_publish_basic_authentication_enabled       = false
  webdeploy_publish_basic_authentication_enabled = false
  virtual_network_subnet_id                      = azurerm_subnet.dfmon.id
  tags                                           = merge(var.tags, { role = "dfmon-tuned" })

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.dfmon.id]
  }

  key_vault_reference_identity_id = azurerm_user_assigned_identity.dfmon.id

  site_config {
    vnet_route_all_enabled                 = true
    application_insights_connection_string = azurerm_application_insights.appinsights.connection_string

    application_stack {
      dotnet_version              = "v8.0"
      use_dotnet_isolated_runtime = true
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME         = "dotnet-isolated"
    WEBSITE_RUN_FROM_PACKAGE         = "https://www.nuget.org/api/v2/package/DurableFunctionsMonitor.DotNetIsolated"
    AzureWebJobsStorage__accountName = azurerm_storage_account.tuned_taskhub.name
    AzureWebJobsStorage__credential  = "managedidentity"
    AzureWebJobsStorage__clientId    = azurerm_user_assigned_identity.dfmon.client_id
    DFM_HUB_NAME                     = var.dfmon_tuned_hub_name
    DFM_MODE                         = "ReadOnly"
    DFM_NONCE                        = var.dfmon_nonce
  }

  depends_on = [time_sleep.dfmon_rbac_propagation, azurerm_private_endpoint.storage]
}
