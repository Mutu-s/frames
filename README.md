Farcaster Frames v2 Demo Kurulumu
Bu rehber, Farcaster Frames v2 Demo'nun nasıl kurulacağını ve çalıştırılacağını adım adım anlatır. Ayrıca, ngrok ile tünel oluşturup Farcaster geliştirici paneline nasıl entegre edeceğinizi de gösterir.

1. Projeyi Klonlayın ve Bağımlılıkları Yükleyin
Öncelikle, Frames v2 Demo projesini GitHub’dan klonlayalım ve gerekli bağımlılıkları yükleyelim:

       git clone https://github.com/Mutu-s/frames
       cd frames
       yarn add @farcaster/frame-sdk
       yarn add wagmi viem@2.x @tanstack/react-query

   Ardından, projeyi screen oturumunda çalıştırarak arka planda çalışmasını sağlayalım:

       screen -S frame
       yarn dev

Eğer port 3000 doluysa, yarn dev --port 4000 gibi farklı bir port belirleyebilirsiniz.

Screen’den çıkmak için:
CTRL + A ardından D tuşlarına basarak arka planda bırakabilirsiniz.

2. Ngrok Kurulumu ve Tünel Açma
Farcaster Frames’in dışarıdan erişilebilir olması için ngrok kullanacağız.

Ngrok’a Kayıt Olun
Ngrok Dashboard adresine giderek kayıt olun ve size verilen Auth Token'ı kopyalayın.
https://dashboard.ngrok.com/get-started/setup/linux

 Ngrok’u Kurun
Aşağıdaki komutları sırasıyla çalıştırarak ngrok'u yükleyin:

    curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
    | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null \
    && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
    | sudo tee /etc/apt/sources.list.d/ngrok.list \
    && sudo apt update \
    && sudo apt install ngrok

Daha sonra, Auth Token’ınızı ekleyin:


    ngrok config add-authtoken SİZE_VERİLEN_KOD
    

Şimdi, uygulamanız için bir HTTP tüneli açalım (eğer yarn dev için farklı bir port belirlediyseniz, onu kullanmalısınız):


    ngrok http http://localhost:3000
    
    
3. Farcaster Frames’e Bağlantı

 https://warpcast.com/~/developers/frames    adresine gidin.
 
   ![image](https://github.com/user-attachments/assets/e1f3f31d-83e9-4667-b5a1-fcb5f360b3d8)

Launch Frame bölümüne aşağıdaki bilgileri girin:

Frame URL: Ngrok’tan kopyaladığınız Forwarding linki

Splash Image URL: https://frames-v2.vercel.app/splash.png

Splash Background Color: #f7f7f7

Preview butonuna tıklayın ve çerçevenizin doğru çalıştığını doğrulayın.


 4. Contract ile Etkileşim
Son olarak, Frame’inizin akıllı kontrat ile etkileşime geçtiğinden ve bağış (donate) işlemlerini gerçekleştirdiğinden emin olun.

Bu adımları tamamladıktan sonra, projeniz Farcaster Frames üzerinde çalışmaya hazır olacaktır.


 ![image](https://github.com/user-attachments/assets/f563edd9-8226-4a71-98d3-75c4858694f2)
