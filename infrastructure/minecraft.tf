resource "digitalocean_ssh_key" "default" {
  name       = "SSH Key for DO Minecraft"
  public_key = file("./droplet-keys/id_rsa.pub")
}

resource "digitalocean_volume" "minecraft_store" {
  region                  = var.region
  name                    = "minecraftstore"
  size                    = var.disk_size
  initial_filesystem_type = "ext4"
  description             = "Minecraft Server storage (/srv)"
  lifecycle {
    prevent_destroy = true
  }
}

resource "digitalocean_droplet" "minecraft_server" {
  image  = "centos-7-x64"
  name   = "minecraft-server"
  region = var.region
  size   = var.size
  ssh_keys = [
    digitalocean_ssh_key.default.fingerprint
  ]
  monitoring = true
  connection {
    user        = "root"
    type        = "ssh"
    private_key = file(var.pvt_key)
    timeout     = "2m"
    host        = digitalocean_droplet.minecraft_server.ipv4_address
  }
  volume_ids = [digitalocean_volume.minecraft_store.id]

  provisioner "file" {
    source      = "conf/minecraft.service"
    destination = "/etc/systemd/system/minecraft.service"
  }

  provisioner "remote-exec" {
    inline = [
      "useradd -u 25565 minecraft",
      "mkdir /mnt/minecraftstore",
      "mount /dev/sda /mnt/minecraftstore",
      "yum install java-1.8.0-openjdk nano screen tmux htop wget -y",
      "wget https://github.com/Tiiffi/mcrcon/releases/download/v0.7.1/mcrcon-0.7.1-linux-x86-64.tar.gz",
      "tar xzf mcrcon-0.7.1-linux-x86-64.tar.gz",
      "cp mcrcon-0.7.1-linux-x86-64/mcrcon /usr/local/bin/mcrcon",
      "systemctl daemon-reload",
      "systemctl enable --now minecraft"
    ]
  }
  provisioner "local-exec" {
    command = "echo IP: ${self.ipv4_address}"
  }
  provisioner "remote-exec" {
    when = destroy
    inline = [
      "systemctl stop minecraft",
      "sync"
    ]
  }
}
