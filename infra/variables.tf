variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "resource_prefix" {
  description = "Prefix for all resource names (lowercase, no hyphens for storage accounts)"
  type        = string
  default     = "dfcompare"
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "westus"
}

variable "load_test_location" {
  description = "Azure region for Azure Load Testing (may differ from primary region)"
  type        = string
  default     = "westus2"
}

variable "tags" {
  description = "Tags applied to all resources"
  type        = map(string)
  default = {
    project     = "durable-function-config-comparison"
    environment = "test"
  }
}

# ─── Autoscale (tuned plan – P0V3) ────────────────────────────
variable "autoscale_min_instances" {
  description = "Minimum instance count for tuned plan autoscale"
  type        = number
  default     = 1
}

variable "autoscale_default_instances" {
  description = "Default instance count for tuned plan autoscale"
  type        = number
  default     = 2
}

variable "autoscale_max_instances" {
  description = "Maximum instance count for tuned plan autoscale"
  type        = number
  default     = 10
}

variable "autoscale_cpu_scale_out_threshold" {
  description = "Average CPU percentage to trigger scale-out"
  type        = number
  default     = 70
}

variable "autoscale_cpu_scale_in_threshold" {
  description = "Average CPU percentage to trigger scale-in"
  type        = number
  default     = 30
}

variable "autoscale_memory_scale_out_threshold" {
  description = "Average memory percentage to trigger scale-out"
  type        = number
  default     = 80
}

# ─── Tuned App Settings ──────────────────────────────────────
variable "tuned_worker_process_count" {
  description = "FUNCTIONS_WORKER_PROCESS_COUNT for tuned app (P0v3 has 1 vCPU)"
  type        = number
  default     = 1
}

variable "tuned_node_max_old_space_mb" {
  description = "Node.js max-old-space-size in MB for tuned app (P0v3 has 4GB RAM)"
  type        = number
  default     = 1536
}

# ─── Durable Functions Monitor ────────────────────────────────
variable "dfmon_nonce" {
  description = "Set to 'i_sure_know_what_i_am_doing' to disable DFMon authentication (dev/test only). Leave empty and configure AAD Easy Auth for production use."
  type        = string
  default     = "i_sure_know_what_i_am_doing"
  sensitive   = true
}

variable "dfmon_baseline_hub_name" {
  description = "Comma-separated task hub names to expose in the baseline DFMon instance. Leave empty to show all hubs."
  type        = string
  default     = ""
}

variable "dfmon_tuned_hub_name" {
  description = "Comma-separated task hub names to expose in the tuned DFMon instance. Leave empty to show all hubs."
  type        = string
  default     = ""
}
