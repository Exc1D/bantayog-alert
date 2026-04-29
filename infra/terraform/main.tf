module "firebase_project" {
  source     = "./modules/firebase-project"
  project_id = var.project_id
}

module "iam" {
  source     = "./modules/iam"
  project_id = var.project_id
  env        = var.env

  depends_on = [module.firebase_project]
}

module "secret_manager" {
  source             = "./modules/secret-manager"
  project_id         = var.project_id
  functions_sa_email = module.iam.functions_sa_email

  depends_on = [module.firebase_project]
}

module "pubsub" {
  source     = "./modules/pubsub"
  project_id = var.project_id

  depends_on = [module.firebase_project]
}

module "bigquery" {
  source     = "./modules/bigquery"
  project_id = var.project_id
  location   = "asia-southeast1"

  depends_on = [module.firebase_project]
}
