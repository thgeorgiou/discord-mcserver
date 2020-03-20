terraform {
  backend "local" {
    path = var.state_path
  }
}

variable "do_token" {}
variable "pub_key" {}
variable "pvt_key" {}
variable "ssh_fingerprint" {}
variable "rcon_pwd" {}
variable "region" {}
variable "size" {}
variable "disk_size" {}

provider "digitalocean" {
  token = var.do_token
}
