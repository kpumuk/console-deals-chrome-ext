require 'json'
require 'fileutils'

FILES = [
  'manifest.json',
  'src/background.js',
  'src/content.js',
  'resources/jquery-3.2.1.min.js',
  'src/popup.html',
  'src/popup.js',
  'src/spinner.css',
  'img/icon-128x128.png',
]

BUILDNAME = 'console-deals'

desc 'Build release package'
task :build do
  manifest = JSON.parse(File.read('manifest.json'))
  FileUtils.rm_rf("#{BUILDNAME}-#{manifest['version']}.zip")
  sh "zip #{BUILDNAME}-#{manifest['version']}.zip #{FILES.map { |x| "'#{x}'" }.join(' ')}"
end

task default: :build
