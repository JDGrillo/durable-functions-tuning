# ─── Virtual Network ─────────────────────────────────────────
resource "azurerm_virtual_network" "vnet" {
  name                = "vnet-${local.name_prefix}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  address_space       = ["10.0.0.0/16"]
  tags                = var.tags
}

# ─── Subnets ──────────────────────────────────────────────────
# Each App Service Plan needs its own delegated subnet for VNet integration.

resource "azurerm_subnet" "baseline" {
  name                 = "snet-baseline"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.0.0/24"]

  delegation {
    name = "Microsoft.Web"
    service_delegation {
      name    = "Microsoft.Web/serverFarms"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

resource "azurerm_subnet" "tuned" {
  name                 = "snet-tuned"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.1.0/24"]

  delegation {
    name = "Microsoft.Web"
    service_delegation {
      name    = "Microsoft.Web/serverFarms"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

resource "azurerm_subnet" "dfmon" {
  name                 = "snet-dfmon"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.2.0/24"]

  delegation {
    name = "Microsoft.Web"
    service_delegation {
      name    = "Microsoft.Web/serverFarms"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

resource "azurerm_subnet" "inline" {
  name                 = "snet-inline"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.4.0/24"]

  delegation {
    name = "Microsoft.Web"
    service_delegation {
      name    = "Microsoft.Web/serverFarms"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

resource "azurerm_subnet" "externalized" {
  name                 = "snet-externalized"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.5.0/24"]

  delegation {
    name = "Microsoft.Web"
    service_delegation {
      name    = "Microsoft.Web/serverFarms"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

resource "azurerm_subnet" "private_endpoints" {
  name                 = "snet-pe"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.3.0/24"]
}

# ─── Private DNS Zones ───────────────────────────────────────
resource "azurerm_private_dns_zone" "blob" {
  name                = "privatelink.blob.core.windows.net"
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags
}

resource "azurerm_private_dns_zone" "queue" {
  name                = "privatelink.queue.core.windows.net"
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags
}

resource "azurerm_private_dns_zone" "table" {
  name                = "privatelink.table.core.windows.net"
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags
}

# ─── Private DNS Zone → VNet Links ───────────────────────────
resource "azurerm_private_dns_zone_virtual_network_link" "blob" {
  name                  = "link-blob"
  resource_group_name   = azurerm_resource_group.rg.name
  private_dns_zone_name = azurerm_private_dns_zone.blob.name
  virtual_network_id    = azurerm_virtual_network.vnet.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "queue" {
  name                  = "link-queue"
  resource_group_name   = azurerm_resource_group.rg.name
  private_dns_zone_name = azurerm_private_dns_zone.queue.name
  virtual_network_id    = azurerm_virtual_network.vnet.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "table" {
  name                  = "link-table"
  resource_group_name   = azurerm_resource_group.rg.name
  private_dns_zone_name = azurerm_private_dns_zone.table.name
  virtual_network_id    = azurerm_virtual_network.vnet.id
}

# ─── Private Endpoints ───────────────────────────────────────
# Each storage account gets private endpoints for the sub-resources
# it needs (blob, queue, table). The private DNS zone group
# auto-registers A records in the linked private DNS zones.

locals {
  storage_private_endpoints = {
    # Baseline task hub (Durable Functions runtime needs blob + queue + table)
    "bl-taskhub-blob" = {
      storage_account_id = azurerm_storage_account.baseline_taskhub.id
      subresource        = "blob"
      dns_zone_id        = azurerm_private_dns_zone.blob.id
    }
    "bl-taskhub-queue" = {
      storage_account_id = azurerm_storage_account.baseline_taskhub.id
      subresource        = "queue"
      dns_zone_id        = azurerm_private_dns_zone.queue.id
    }
    "bl-taskhub-table" = {
      storage_account_id = azurerm_storage_account.baseline_taskhub.id
      subresource        = "table"
      dns_zone_id        = azurerm_private_dns_zone.table.id
    }

    # Tuned task hub
    "tn-taskhub-blob" = {
      storage_account_id = azurerm_storage_account.tuned_taskhub.id
      subresource        = "blob"
      dns_zone_id        = azurerm_private_dns_zone.blob.id
    }
    "tn-taskhub-queue" = {
      storage_account_id = azurerm_storage_account.tuned_taskhub.id
      subresource        = "queue"
      dns_zone_id        = azurerm_private_dns_zone.queue.id
    }
    "tn-taskhub-table" = {
      storage_account_id = azurerm_storage_account.tuned_taskhub.id
      subresource        = "table"
      dns_zone_id        = azurerm_private_dns_zone.table.id
    }

    # Baseline workload blobs (activities only use blob)
    "bl-blob" = {
      storage_account_id = azurerm_storage_account.baseline_blobs.id
      subresource        = "blob"
      dns_zone_id        = azurerm_private_dns_zone.blob.id
    }

    # Tuned workload blobs
    "tn-blob" = {
      storage_account_id = azurerm_storage_account.tuned_blobs.id
      subresource        = "blob"
      dns_zone_id        = azurerm_private_dns_zone.blob.id
    }

    # DFMon runtime storage
    "dfmon-blob" = {
      storage_account_id = azurerm_storage_account.dfmon.id
      subresource        = "blob"
      dns_zone_id        = azurerm_private_dns_zone.blob.id
    }
    "dfmon-queue" = {
      storage_account_id = azurerm_storage_account.dfmon.id
      subresource        = "queue"
      dns_zone_id        = azurerm_private_dns_zone.queue.id
    }
    "dfmon-table" = {
      storage_account_id = azurerm_storage_account.dfmon.id
      subresource        = "table"
      dns_zone_id        = azurerm_private_dns_zone.table.id
    }

    # ─── OOM Scenario: Inline-payloads ───────────────────────────
    "il-taskhub-blob" = {
      storage_account_id = azurerm_storage_account.inline_taskhub.id
      subresource        = "blob"
      dns_zone_id        = azurerm_private_dns_zone.blob.id
    }
    "il-taskhub-queue" = {
      storage_account_id = azurerm_storage_account.inline_taskhub.id
      subresource        = "queue"
      dns_zone_id        = azurerm_private_dns_zone.queue.id
    }
    "il-taskhub-table" = {
      storage_account_id = azurerm_storage_account.inline_taskhub.id
      subresource        = "table"
      dns_zone_id        = azurerm_private_dns_zone.table.id
    }
    "il-blob" = {
      storage_account_id = azurerm_storage_account.inline_blobs.id
      subresource        = "blob"
      dns_zone_id        = azurerm_private_dns_zone.blob.id
    }

    # ─── OOM Scenario: Externalized-payloads ─────────────────────
    "ex-taskhub-blob" = {
      storage_account_id = azurerm_storage_account.externalized_taskhub.id
      subresource        = "blob"
      dns_zone_id        = azurerm_private_dns_zone.blob.id
    }
    "ex-taskhub-queue" = {
      storage_account_id = azurerm_storage_account.externalized_taskhub.id
      subresource        = "queue"
      dns_zone_id        = azurerm_private_dns_zone.queue.id
    }
    "ex-taskhub-table" = {
      storage_account_id = azurerm_storage_account.externalized_taskhub.id
      subresource        = "table"
      dns_zone_id        = azurerm_private_dns_zone.table.id
    }
    "ex-blob" = {
      storage_account_id = azurerm_storage_account.externalized_blobs.id
      subresource        = "blob"
      dns_zone_id        = azurerm_private_dns_zone.blob.id
    }
  }
}

resource "azurerm_private_endpoint" "storage" {
  for_each = local.storage_private_endpoints

  name                = "pe-${local.name_prefix}-${each.key}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  subnet_id           = azurerm_subnet.private_endpoints.id
  tags                = var.tags

  private_service_connection {
    name                           = "psc-${each.key}"
    private_connection_resource_id = each.value.storage_account_id
    subresource_names              = [each.value.subresource]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "dns-${each.key}"
    private_dns_zone_ids = [each.value.dns_zone_id]
  }
}
