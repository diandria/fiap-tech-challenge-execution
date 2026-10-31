terraform {
  backend "s3" {
    bucket = "fiap-tech-challenge-tfstate-108337503570"
    key    = "execution/terraform.tfstate"
    region = "us-east-1"

    encrypt = true

    # Native S3 locking, via a .tflock file next to the state.
    use_lockfile = true
  }
}
