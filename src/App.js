import{ useState, useEffect } from 'react';
import { NFTStorage, File } from 'nft.storage'
import { Buffer } from 'buffer';
import { ethers } from 'ethers';
import axios from 'axios';

// Components
import Spinner from 'react-bootstrap/Spinner';
import Navigation from './components/Navigation';

// ABIs
import NFT from './abis/NFT.json'

// Config
import config from './config.json';

function App() {
  const [provider, setProvider] = useState(null)
  const [account, setAccount] = useState(null)
  const [nft, setNFT] = useState(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [image, setImage] = useState(null)
  const [url, setURL] = useState(null)


  const loadBlockchainData = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    setProvider(provider)

    const network = await provider.getNetwork()

    const nft = new ethers.Contract(config[network.chainId].nft.address, NFT, provider)
    setNFT(nft)

  }




  const submitHandler = async (e) => {
    e.preventDefault() //Stops page to refteshing


    //  Вызываем ИИ API для генерации изображения по описанию
    const imageData = createImage() 


    // Загружаем картинку на IPFS (NFT.Storage)
    const url = await uploadImage(imageData)

    // Минтим NFT
    await mintImage(url)

    console.log("Success!")
  }

  const createImage = async () => {
    console.log("Generating Image...")

    const URL = `https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2`

    const response = await axios({
      url: URL,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.REACT_APP_HUGGING_FACE_API_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({
        inputs: description, options: { wait_for_model: true},
      }),
      responseType: 'arraybuffer',
    })

    const type = response.headers['content-type']
    const data = response.data

    const base64data = Buffer.from(data).toString('base64')
    const img = `data:${type};base64,` + base64data //<-- Рендерим на странице
    setImage(img)

    return data
  }

  const uploadImage = async (imageData) => {
    console.log("Uploading Image...")

    // Create instance to NFT.Storage
    const nftstorage = new NFTStorage({ token: process.env.REACT_APP_NFT_STORAGE_API_KEY })
    
    // Send rquest to store image
    const { ipnft } = await nftstorage.store({
      image: new File([imageData], "image.jpeg", { type: "image/jpeg"}),
      name: name,
      description: description,
    })

    // Save the URL
    const url = `https://ipfs.io/ipfs/${ipnft}/metadata.json`
    setURL(url)

    return url
 }

  const mintImage = async (tokenURI) => {
    console.log("Ожидаем минт....")

    const signer = await provider.getSigner()
    const transaction = await nft.connect(signer).mint(tokenURI, { value: ethers.utils.parseUnits("1", "ether") })
    await transaction.wait()
  }


  useEffect(() => {
    loadBlockchainData()
  }, [])

  return (
    <div>
      <Navigation account={account} setAccount={setAccount} />

      <div className = "form">
        <form onSubmit={submitHandler}>
          <input type="text" placeholder="Придумайте имя..." onChange={(e) => { setName(e.target.value) }}></input>
          <input type="text" placeholder="Придумайте описание..." onChange={(e) => { setDescription(e.target.value) }}></input>
          <input type="submit" value="Создать & Заминтить"></input>
        </form>

        <div className="image">
          <img src={image} alt="Сгенерированная ИИ NFT"/>
        </div>


      </div>

      <p>View&nbsp;<a href={url} target="_blank" rel="noreferrer"> MetaData </a> </p>

    </div>
  );
}

export default App;
