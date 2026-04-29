variable "project_id" {
  type = string
}

variable "oncall_backend_email" {
  type        = string
  description = "Email for backend/infrastructure alerts"
}

variable "oncall_ops_email" {
  type        = string
  description = "Email for operational alerts (SMS, citizen-facing)"
}

variable "oncall_compliance_email" {
  type        = string
  description = "Email for compliance alerts (audit gap)"
}
