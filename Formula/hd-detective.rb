class HdDetective < Formula
  desc "Next-Gen macOS Storage Intelligence & Real-Time Hard Drive Optimizer"
  homepage "https://github.com/LinusInnovator/zerospace"
  url "https://github.com/LinusInnovator/zerospace/releases/download/v2.0.0/hd-optimizer-detective-v2.0.0.tar.gz"
  sha256 "c53cf1a850900ce26acbfc33f62d0c21c07728277e6b4ee5c380afcaed301fbb"
  head "https://github.com/LinusInnovator/zerospace.git", branch: "main"
  license "MIT"

  # Uses the current Homebrew Python 3 runtime; the project supports Python 3.9+.
  depends_on "python"

  def install
    pkgshare.install Dir["*"]
    (bin/"hd-detective").write <<~EOS
      #!/bin/bash
      cd "#{pkgshare}" && exec python3 scanner_backend.py "$@"
    EOS
  end

  test do
    assert_match "ZeroSpace 2.0.0", shell_output("#{bin}/hd-detective --version")
  end
end
