require 'json'

FILES = [
  'manifest.json',
  'background.js',
  'content.js',
  'jquery-3.2.1.min.js',
  'popup.html',
  'popup.js',
  'spinner.css',
  'img/icon-*.png',
]

BUILDNAME = 'console-deals'

task :build do
  manifest = JSON.parse(File.read('manifest.json'))
  File.delete("#{BUILDNAME}-#{manifest['version']}.zip")
  sh "zip #{BUILDNAME}-#{manifest['version']}.zip #{FILES.map { |x| "'#{x}'" }.join(' ')}"
end
