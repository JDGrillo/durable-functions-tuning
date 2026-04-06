output "resource_group_name" {
  value = azurerm_resource_group.rg.name
}

output "baseline_function_app_url" {
  value = "https://${azurerm_linux_function_app.baseline.default_hostname}"
}

output "tuned_function_app_url" {
  value = "https://${azurerm_linux_function_app.tuned.default_hostname}"
}

output "app_insights_connection_string" {
  value     = azurerm_application_insights.appinsights.connection_string
  sensitive = true
}

output "app_insights_instrumentation_key" {
  value     = azurerm_application_insights.appinsights.instrumentation_key
  sensitive = true
}

output "baseline_taskhub_account_name" {
  value = azurerm_storage_account.baseline_taskhub.name
}

output "tuned_taskhub_account_name" {
  value = azurerm_storage_account.tuned_taskhub.name
}

output "baseline_blobs_account_name" {
  value = azurerm_storage_account.baseline_blobs.name
}

output "tuned_blobs_account_name" {
  value = azurerm_storage_account.tuned_blobs.name
}

output "load_test_id" {
  value = azurerm_load_test.loadtest.id
}

output "log_analytics_workspace_id" {
  value = azurerm_log_analytics_workspace.law.id
}

output "dfmon_baseline_url" {
  value = "https://${azurerm_windows_function_app.dfmon_baseline.default_hostname}"
}

output "dfmon_tuned_url" {
  value = "https://${azurerm_windows_function_app.dfmon_tuned.default_hostname}"
}
