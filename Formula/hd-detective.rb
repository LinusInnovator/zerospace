class HdDetective < Formula
  desc "Next-Gen macOS Storage Intelligence & Real-Time Hard Drive Optimizer"
  homepage "https://github.com/your-username/hd-optimizer-detective"
  url "https://github.com/your-username/hd-optimizer-detective/archive/refs/tags/v2.0.0.tar.gz"
  sha256 "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  license "MIT"

  depends_on "python@3.11"

  def install
    pkgshare.install Dir["*"]
    (bin/"hd-detective").write <<~EOS
      #!/bin/bash
      cd "#{pkgshare}" && exec python3 scanner_backend.py "$@"
    EOS
  end

  test do
    system "#{bin}/hd-detective", "--version"
  end
end
