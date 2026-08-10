class HdDetective < Formula
  desc "Next-Gen macOS Storage Intelligence & Real-Time Hard Drive Optimizer"
  homepage "https://github.com/LinusInnovator/zerospace"
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
